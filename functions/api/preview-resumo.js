/**
 * Cloudflare Pages Function — GET /api/preview-resumo?id=<resumo_id>
 *
 * Serve o HTML de um resumo de AMOSTRA GRÁTIS, SEM exigir login.
 * Só entrega resumos que estão na allowlist abaixo (amostras públicas),
 * para não vazar o catálogo pago. Usa a SERVICE KEY.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

// IDs liberados como amostra grátis na landing
const PREVIEW_IDS = [
  'c4e87815-7a3d-4ec1-a019-334f2513854a', // Microbiologia — Parcial 2 prática
];

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Config error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const id = new URL(request.url).searchParams.get('id') || PREVIEW_IDS[0];
  if (!PREVIEW_IDS.includes(id)) {
    return new Response(JSON.stringify({ error: 'Resumo não disponível como amostra' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/resumos?id=eq.${id}&select=title,content`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
  );
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Falha ao buscar amostra' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Amostra não encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ title: rows[0].title || 'Amostra', content: rows[0].content || '' }), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
