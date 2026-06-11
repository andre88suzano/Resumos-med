/**
 * Cloudflare Pages Function — GET /api/feedbacks
 *
 * Retorna os depoimentos (materia=_feedback_) com a imagem (content) para
 * qualquer usuário logado. São prova social — leitura liberada a autenticados,
 * mas servida via SERVICE KEY para que a coluna `content` possa ser revogada
 * do anon/authenticated no banco.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_KEY
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

  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const user = await getUser(token, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/resumos?materia=eq._feedback_&select=id,title,description,content&order=created_at.desc`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
  );
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Falha ao buscar feedbacks' }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
  const rows = await res.json();
  return new Response(JSON.stringify({ feedbacks: Array.isArray(rows) ? rows : [] }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
