/**
 * Cloudflare Pages Function — POST /api/device-token
 *
 * Atualiza o active_token de um usuário usando service role (bypassa RLS).
 * Verifica o JWT do usuário antes de atualizar.
 *
 * Body: { user_id, token }
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

  // Verificar usuário via Supabase auth
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

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
  }

  const { user_id, token } = body;

  // Garantir que só atualiza o próprio usuário
  if (user_id !== verifiedUserId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Atualizar active_token com service role (bypassa RLS)
  const updateRes = await fetch(
    `${sbUrl}/rest/v1/approved_users?user_id=eq.${user_id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': sbServiceKey,
        'Authorization': `Bearer ${sbServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ active_token: token }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
