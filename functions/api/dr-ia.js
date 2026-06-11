/**
 * Cloudflare Pages Function — POST /api/dr-ia
 * Proxy para Groq API (gratuito)
 *
 * Variável de ambiente necessária:
 *   GROQ_API_KEY = gsk_...
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

// Valida o JWT do usuário logado contra o Supabase. Retorna o user ou null.
async function getUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null;
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

  // Exige usuário autenticado — impede que terceiros gastem a cota do Groq
  const user = await getUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY não configurada' }), {
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

  // Groq usa formato OpenAI
  const groqMessages = [];
  if (system) groqMessages.push({ role: 'system', content: system });
  messages.forEach(m => groqMessages.push({ role: m.role, content: m.content }));

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Erro na API Groq', detail: data }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Converter resposta Groq → formato Anthropic (frontend não muda)
    const text = data.choices?.[0]?.message?.content || '';
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
