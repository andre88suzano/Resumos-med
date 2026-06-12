/**
 * Cloudflare Pages Function — GET /api/resumo-content?id=<resumo_id>
 *
 * Entrega o HTML de UM resumo APENAS se o usuário logado tiver acesso válido
 * (linha em user_access não expirada) ou for admin. Usa a SERVICE KEY, então
 * funciona mesmo depois de revogarmos a coluna `content` do anon/authenticated.
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

async function hasAccess(userId, resumoId, env) {
  const nowIso = new Date().toISOString();
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/user_access?user_id=eq.${userId}&resumo_id=eq.${resumoId}&select=resumo_id,expires_at`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return false;
    // Acesso válido = existe linha sem expiração OU com expires_at no futuro
    return rows.some(r => !r.expires_at || r.expires_at > nowIso);
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
  const resumoId = url.searchParams.get('id');
  if (!resumoId) {
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
    const ok = await hasAccess(user.id, resumoId, env);
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Sem acesso a este resumo' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  }

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/resumos?id=eq.${resumoId}&select=content`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
  );
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Falha ao buscar resumo' }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Resumo não encontrado' }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  return new Response(JSON.stringify({ content: rows[0].content || '' }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
