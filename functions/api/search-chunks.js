/**
 * Cloudflare Pages Function — POST /api/search-chunks
 * Busca semântica nos chunks do Supabase via embeddings Groq
 *
 * Variáveis de ambiente necessárias:
 *   GROQ_API_KEY        = gsk_...
 *   SUPABASE_URL        = https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY = eyJ...
 */

const ALLOWED_ORIGINS = [
  'https://resumos-med.pages.dev',
  'https://medresumenes.pages.dev',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

async function getEmbedding(text, apiKey) {
  const res = await fetch('https://api.groq.com/openai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'nomic-embed-text-v1.5',
      input: text,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq embedding error: ${err}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const groqKey = env.GROQ_API_KEY;
  const sbUrl   = env.SUPABASE_URL;
  const sbKey   = env.SUPABASE_SERVICE_KEY;

  if (!groqKey || !sbUrl || !sbKey) {
    return new Response(JSON.stringify({ error: 'Variáveis de ambiente não configuradas' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  let body;
  try { body = await request.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Body JSON inválido' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const { query, materia, semestre, limit = 5 } = body;
  if (!query) {
    return new Response(JSON.stringify({ error: 'Campo obrigatório: query' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  let queryEmbedding;
  try {
    queryEmbedding = await getEmbedding(query, groqKey);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Falha ao gerar embedding: ' + err.message }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  // Chamar RPC do Supabase para busca vetorial
  const rpcBody = {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: parseInt(limit),
    filtro_materia: materia || null,
    filtro_semestre: semestre ? parseInt(semestre) : null,
  };

  try {
    const res = await fetch(`${sbUrl}/rest/v1/rpc/buscar_chunks_similares`, {
      method: 'POST',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcBody),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: 'Supabase RPC error', detail: err }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const chunks = await res.json();
    return new Response(JSON.stringify({ chunks: Array.isArray(chunks) ? chunks : [] }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Falha na busca: ' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}
