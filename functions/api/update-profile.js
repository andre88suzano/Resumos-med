/**
 * Cloudflare Pages Function — POST /api/update-profile
 *
 * Atualiza o PRÓPRIO perfil do usuário em approved_users usando a service role
 * (bypassa RLS), depois de verificar o JWT. approved_users não tem policy de
 * UPDATE para o aluno comum, então a escrita do perfil passa por aqui.
 *
 * Whitelist de campos — NUNCA permite is_admin, approved, email, user_id,
 * active_token (segurança: sem escalonamento e sem burlar o lock de dispositivo).
 *
 * Body: { name?, turma?, semestre_atual?, semestre_confirmado_em?, last_seen? }
 * Header: Authorization: Bearer <user_jwt>
 */

const ALLOWED = ['name', 'turma', 'semestre_atual', 'semestre_confirmado_em', 'last_seen'];

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
  if (!verifiedUserId) {
    return new Response(JSON.stringify({ error: 'Invalid user' }), { status: 401 });
  }

  let body = {};
  try { body = await request.json(); } catch { /* body inválido tratado abaixo */ }

  // Só passa adiante os campos permitidos que vieram no body.
  const updates = {};
  for (const k of ALLOWED) {
    if (body && Object.prototype.hasOwnProperty.call(body, k)) updates[k] = body[k];
  }
  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ error: 'No valid fields' }), { status: 400 });
  }

  // PATCH só na própria linha (WHERE user_id = id verificado do JWT).
  const res = await fetch(
    `${sbUrl}/rest/v1/approved_users?user_id=eq.${verifiedUserId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': sbServiceKey,
        'Authorization': `Bearer ${sbServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updates),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
