/**
 * Cloudflare Pages Function — POST /api/dr-ia
 * Proxy para Google Gemini API
 *
 * Variável de ambiente necessária (Cloudflare Pages → Settings → Variables):
 *   GEMINI_API_KEY = AIza...
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

  // Converter formato Anthropic → Gemini
  const { system, messages } = body;

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const geminiBody = {
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Erro na API Gemini', detail: data }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Converter resposta Gemini → formato Anthropic (para não mudar o frontend)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return new Response(JSON.stringify({
      content: [{ type: 'text', text }]
    }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Falha na comunicação com Gemini: ' + err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}
