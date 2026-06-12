/**
 * Cloudflare Pages Function — POST /api/dr-ia
 *
 * Proxy do Dr. IA com FALLBACK EM CASCATA: tenta os provedores na ordem;
 * se um estiver sem tokens / com rate-limit / com erro, cai silenciosamente
 * para o próximo, até o último (pago) responder. O usuário nunca vê erro —
 * apenas pode demorar um pouco mais quando há troca de provedor.
 *
 * Todos os provedores usam o formato OpenAI (chat/completions).
 * A cadeia é montada a partir das variáveis de ambiente abaixo; provedor
 * sem chave configurada é simplesmente ignorado. Ordem: grátis → pago.
 *
 *   GROQ_API_KEY            (grátis)   + GROQ_API_KEY_2, GROQ_API_KEY_3 (chaves extras)
 *   GROQ_MODEL             (opcional, default llama-3.3-70b-versatile)
 *   CEREBRAS_API_KEY        (grátis)   + CEREBRAS_MODEL (default llama-3.3-70b)
 *   GEMINI_API_KEY          (grátis)   + GEMINI_MODEL   (default gemini-2.0-flash)
 *   OPENROUTER_API_KEY                 + OPENROUTER_FREE_MODEL (grátis)  e
 *                                        OPENROUTER_PAID_MODEL (pago, último recurso)
 *   OPENAI_API_KEY         (pago)      + OPENAI_MODEL (default gpt-4o-mini)
 *
 * Ordem da cascata: Groq → Cerebras → Gemini → OpenRouter(grátis) →
 *                   OpenRouter(pago) → OpenAI. Provedor sem chave é pulado.
 *
 * Auth: SUPABASE_URL + SUPABASE_SERVICE_KEY (valida o usuário logado).
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

// Monta a cadeia de provedores na ordem grátis → pago, pulando os sem chave.
function buildChain(env) {
  const groqModel = env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const chain = [];

  // 1) Groq (grátis) — chave principal + extras
  for (const key of [env.GROQ_API_KEY, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3]) {
    if (key) chain.push({
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key, model: groqModel, headers: {},
    });
  }

  // 2) Cerebras (grátis) — OpenAI-compatível
  if (env.CEREBRAS_API_KEY) {
    chain.push({
      name: 'cerebras',
      url: 'https://api.cerebras.ai/v1/chat/completions',
      key: env.CEREBRAS_API_KEY, model: env.CEREBRAS_MODEL || 'llama-3.3-70b', headers: {},
    });
  }

  // 3) Google Gemini (grátis) — endpoint OpenAI-compatível
  if (env.GEMINI_API_KEY) {
    chain.push({
      name: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      key: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || 'gemini-2.0-flash', headers: {},
    });
  }

  // 4) OpenRouter — modelo grátis
  if (env.OPENROUTER_API_KEY && env.OPENROUTER_FREE_MODEL) {
    chain.push({
      name: 'openrouter-free',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: env.OPENROUTER_API_KEY, model: env.OPENROUTER_FREE_MODEL,
      headers: { 'HTTP-Referer': 'https://resumos-med.pages.dev', 'X-Title': 'MedResumenes' },
    });
  }

  // 3) OpenRouter — modelo pago (último recurso, "começa a cobrar")
  if (env.OPENROUTER_API_KEY && env.OPENROUTER_PAID_MODEL) {
    chain.push({
      name: 'openrouter-paid',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: env.OPENROUTER_API_KEY, model: env.OPENROUTER_PAID_MODEL,
      headers: { 'HTTP-Referer': 'https://resumos-med.pages.dev', 'X-Title': 'MedResumenes' },
    });
  }

  // 4) OpenAI (pago) — fallback final opcional
  if (env.OPENAI_API_KEY) {
    chain.push({
      name: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      key: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || 'gpt-4o-mini', headers: {},
    });
  }

  return chain;
}

// Tenta UM provedor com timeout. Retorna {ok, text} ou {ok:false, retriable}.
async function callProvider(p, messages, maxTokens) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28000);
  try {
    const res = await fetch(p.url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}`, ...p.headers },
      body: JSON.stringify({ model: p.model, messages, max_tokens: maxTokens, temperature: 0.7 }),
    });

    if (!res.ok) {
      // 429 (sem tokens / rate limit) e 5xx → tenta o próximo provedor.
      // 4xx de configuração (401/403/404/400) → também tenta o próximo,
      // pois pode ser chave/modelo inválido naquele provedor específico.
      return { ok: false, retriable: true };
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) return { ok: false, retriable: true };
    return { ok: true, text };
  } catch (_) {
    // timeout / rede → próximo provedor
    return { ok: false, retriable: true };
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const user = await getUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
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
  const chatMessages = [];
  if (system) chatMessages.push({ role: 'system', content: system });
  (messages || []).forEach(m => chatMessages.push({ role: m.role, content: m.content }));
  const maxTokens = Math.min(Number(body.max_tokens) || 1000, 1500);

  const chain = buildChain(env);
  if (chain.length === 0) {
    return new Response(JSON.stringify({ error: 'Nenhum provedor de IA configurado' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  // Cascata: tenta cada provedor em ordem; primeiro sucesso vence.
  for (const p of chain) {
    const r = await callProvider(p, chatMessages, maxTokens);
    if (r.ok) {
      return new Response(JSON.stringify({ content: [{ type: 'text', text: r.text }] }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
    // falhou → continua para o próximo sem expor erro
  }

  // Todos falharam — resposta amigável, nunca um erro técnico cru.
  return new Response(JSON.stringify({
    content: [{ type: 'text', text: 'Dr(a). IA: Estou um pouco sobrecarregado agora 😅. Tenta me perguntar de novo em alguns segundos!' }]
  }), {
    status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
