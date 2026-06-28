/**
 * Cloudflare Pages Function — POST /api/ensure-profile
 *
 * Garante que o usuário logado tenha uma linha em approved_users.
 * Usa a service role (bypassa RLS), depois de verificar o JWT do usuário.
 * Cria a linha SÓ se ainda não existir (on_conflict=email, ignore-duplicates)
 * — nunca sobrescreve is_admin/approved de quem já tem perfil, e nunca deixa
 * o cliente se tornar admin (is_admin sempre false na criação).
 *
 * Body: { name? }
 * Header: Authorization: Bearer <user_jwt>
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const sbUrl = env.SUPABASE_URL;
  const sbServiceKey = env.SUPABASE_SERVICE_KEY;

  if (!sbUrl || !sbServiceKey) {
    return new Response(JSON.stringify({ error: 'Config missing' }), { status: 500 });
  }

  // Verificar JWT do usuário
  const authHeader = request.headers.get('Authorization') || '';
  const userJwt = authHeader.replace('Bearer ', '');
  if (!userJwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const userRes = await fetch(`${sbUrl}/auth/v1/user`, {
    headers: {
      'apikey': sbServiceKey,
      'Authorization': `Bearer ${userJwt}`,
    },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  const userData = await userRes.json();
  const verifiedUserId = userData.id;
  const verifiedEmail = (userData.email || '').trim();
  if (!verifiedUserId || !verifiedEmail) {
    return new Response(JSON.stringify({ error: 'Invalid user' }), { status: 401 });
  }

  let body = {};
  try { body = await request.json(); } catch { /* body opcional */ }
  const nome = (body && typeof body.name === 'string' && body.name.trim())
    ? body.name.trim()
    : (verifiedEmail.split('@')[0] || 'Aluno');

  // Cria a linha só se ainda não existir (email é UNIQUE). Não toca em quem já tem.
  const insertRes = await fetch(
    `${sbUrl}/rest/v1/approved_users?on_conflict=email`,
    {
      method: 'POST',
      headers: {
        'apikey': sbServiceKey,
        'Authorization': `Bearer ${sbServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: verifiedUserId,
        email: verifiedEmail,
        name: nome,
        approved: true,
        is_admin: false,
      }),
    }
  );

  if (!insertRes.ok) {
    const err = await insertRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
