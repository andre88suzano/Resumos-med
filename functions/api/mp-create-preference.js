/**
 * Cloudflare Pages Function — POST /api/mp-create-preference
 *
 * Variáveis de ambiente necessárias (configurar no dashboard do Cloudflare Pages):
 *   MP_ACCESS_TOKEN  → Token de acesso do Mercado Pago (ex: TEST-xxxx ou APP_USR-xxxx)
 *   SUPABASE_URL     → URL do projeto Supabase (ex: https://xxx.supabase.co)
 *   SUPABASE_SERVICE_KEY → Service Role Key do Supabase (NÃO expor no frontend)
 *
 * Body esperado (JSON):
 *   {
 *     items: [{ title, quantity, unit_price, currency_id? }],
 *     payer_email: string,
 *     external_reference: string,   // formato: "{compra_id}:{user_id}:{tipo}"
 *     notification_url: string      // URL do webhook (ex: https://seu-site.pages.dev/api/mp-webhook)
 *   }
 *
 * Retorna:
 *   { preference_id, init_point }
 */

const ALLOWED_ORIGINS = [
  'https://resumos-med.pages.dev',
  'https://medresumenes.pages.dev',
  // Adicione aqui o domínio personalizado se tiver, ex:
  // 'https://medresumenes.com.br',
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

  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  // Verificar token base
  if (!env.MP_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: 'MP_ACCESS_TOKEN não configurado' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const { items, payer_email, external_reference, notification_url, test_mode, metodo } = body;

  // Modo teste: usa token sandbox (só aceito se vier com flag explícita)
  const mpToken = test_mode && env.MP_ACCESS_TOKEN_TEST
    ? env.MP_ACCESS_TOKEN_TEST
    : env.MP_ACCESS_TOKEN;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: 'items é obrigatório' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  // metodo: 'pix' → unit_price = valor original, exclui cartão/débito
  //         'cartao' → unit_price = valor/0.95, exclui PIX (bank_transfer)
  //         undefined/outro → comportamento anterior (cartão com desconto PIX)
  const isPix = metodo === 'pix';
  const isCartao = metodo === 'cartao';

  const toCardPrice = (v) => Math.round((parseFloat(v) / 0.95) * 100) / 100;

  const getUnitPrice = (v) => {
    if (isPix) return parseFloat(v);          // PIX: preço original
    return toCardPrice(v);                    // cartão ou fallback: preço com taxa
  };

  // Tipos excluídos conforme método escolhido
  const excludedTypes = isPix
    ? [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'ticket' }]  // só PIX
    : isCartao
      ? [{ id: 'bank_transfer' }]                                        // só cartão/débito
      : [];                                                              // fallback: todos

  // Montar payload para o Mercado Pago
  const mpPayload = {
    items: items.map(item => ({
      title: item.title || 'MedResúmenes',
      quantity: item.quantity || 1,
      unit_price: getUnitPrice(item.unit_price),
      currency_id: item.currency_id || 'BRL',
    })),
    payer: payer_email ? { email: payer_email } : undefined,
    external_reference: external_reference || '',
    notification_url: notification_url || '',
    back_urls: {
      success: 'https://resumos-med.pages.dev/?pagamento=sucesso',
      failure: 'https://resumos-med.pages.dev/?pagamento=falha',
      pending: 'https://resumos-med.pages.dev/?pagamento=pendente',
    },
    // auto_return: redireciona quando aprovado (cartão) ou após Pix confirmado
    auto_return: 'approved',
    // binary_mode false: permite status pendente (Pix aguardando confirmação)
    binary_mode: false,
    statement_descriptor: 'MedResumenes',
    payment_methods: {
      excluded_payment_types: excludedTypes,
      installments: isCartao ? 12 : 1,
    },
  };

  try {
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error('Erro Mercado Pago:', mpData);
      return new Response(JSON.stringify({ error: 'Erro ao criar preferência no Mercado Pago', detail: mpData }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify({
      preference_id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });

  } catch (err) {
    console.error('Fetch MP error:', err);
    return new Response(JSON.stringify({ error: 'Falha na comunicação com Mercado Pago' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}
