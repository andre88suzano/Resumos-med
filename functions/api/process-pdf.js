/**
 * Cloudflare Pages Function — POST /api/process-pdf
 * Recebe texto extraído do PDF, gera embeddings via Groq e salva no Supabase
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

function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 20) chunks.push(chunk);
    i += chunkSize - overlap;
  }
  return chunks;
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

async function saveChunk(supabaseUrl, serviceKey, row) {
  const res = await fetch(`${supabaseUrl}/rest/v1/livros_chunks`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase insert error: ${err}`);
  }
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

  const { text, livro, materia, semestre, pagina_base = 1 } = body;
  if (!text || !livro || !materia) {
    return new Response(JSON.stringify({ error: 'Campos obrigatórios: text, livro, materia' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const chunks = chunkText(text, 500, 50);
  let chunks_salvos = 0;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    try {
      const embedding = await getEmbedding(chunk, groqKey);
      await saveChunk(sbUrl, sbKey, {
        livro,
        materia,
        semestre: semestre ? parseInt(semestre) : null,
        pagina: pagina_base + idx,
        conteudo: chunk,
        embedding: JSON.stringify(embedding),
      });
      chunks_salvos++;
    } catch (err) {
      console.error(`Chunk ${idx} error:`, err.message);
      // Continua tentando os outros chunks
    }
  }

  return new Response(JSON.stringify({ chunks_salvos, total_chunks: chunks.length }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
