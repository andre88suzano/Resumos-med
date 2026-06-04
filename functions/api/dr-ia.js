/**
 * Cloudflare Pages Function — POST /api/dr-ia
 * Proxy para Google Gemini API (usando chave AQ. do AI Studio)
 *
 * Variável de ambiente necessária:
 *   GEMINI_API_KEY = sua chave do AI Studio
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

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  let body;
  try { body = await request.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const { system, messages } = body;

  // Montar contents para Gemini
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const geminiBody = {
    ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
  };

  try {
    // Chave AQ. usa endpoint oauth2 do AI Studio
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Erro na API Gemini', detail: data }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return new Response(JSON.stringify({
      content: [{ type: 'text', text }]
    }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Falha: ' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}
