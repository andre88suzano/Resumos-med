/**
 * Cloudflare Pages Function — GET /api/questao-content?id=<questao_id>
 *
 * Entrega o HTML de UMA banca de questões APENAS se o usuário logado tiver
 * acesso (linha em user_questoes_access) ou for admin. Usa a SERVICE KEY.
 *
 * Variáveis de ambiente:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 */

const ALLOWED_ORIGINS = [
  'https://resumos-med.pages.dev',
  'https://medresumenes.pages.dev',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

async function getUser(token, env) {
  if (!token) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

async function isAdmin(userId, env) {
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/approved_users?user_id=eq.${userId}&select=is_admin`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] && rows[0].is_admin === true;
  } catch { return false; }
}

async function hasAccess(userId, questaoId, env) {
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_questoes_access?user_id=eq.${userId}&questao_id=eq.${questaoId}&select=questao_id`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Config error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const url = new URL(request.url);
  const questaoId = url.searchParams.get('id');
  if (!questaoId) {
    return new Response(JSON.stringify({ error: 'id obrigatório' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const user = await getUser(token, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const admin = await isAdmin(user.id, env);
  if (!admin) {
    const ok = await hasAccess(user.id, questaoId, env);
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Sem acesso a esta banca' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  }

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/questoes?id=eq.${questaoId}&select=content`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
  );
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Falha ao buscar questão' }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Banca não encontrada' }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  return new Response(JSON.stringify({ content: rows[0].content || '' }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
