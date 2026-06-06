/**
 * Cloudflare Pages Function — POST /api/mp-create-pix
 *
 * Cria um pagamento Pix via Mercado Pago e retorna o QR code e copia e cola.
 *
 * Variáveis de ambiente necessárias:
 *   MP_ACCESS_TOKEN      → Token do Mercado Pago (APP_USR-...)
 *   SUPABASE_URL         → https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY → Service Role Key
 *
 * Body esperado (JSON):
 *   {
 *     amount: number,
 *     description: string,
 *     payer_email: string,
 *     external_reference: string,   // "{compra_id}:{user_id}:{tipo}"
 *     notification_url: string
 *   }
 *
 * Retorna:
 *   { payment_id, qr_code, qr_code_base64, status }
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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const mpToken = env.MP_ACCESS_TOKEN;
  if (!mpToken) {
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

  const { amount, description, payer_email, external_reference, notification_url } = body;

  if (!amount || !payer_email) {
    return new Response(JSON.stringify({ error: 'amount e payer_email são obrigatórios' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  // ID único para idempotência (evita pagamentos duplicados)
  const idempotencyKey = `pix-${external_reference}-${Date.now()}`;

  try {
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: parseFloat(amount),
        description: description || 'MedResúmenes',
        payment_method_id: 'pix',
        payer: { email: payer_email },
        external_reference: external_reference || '',
        notification_url: notification_url || '',
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // expira em 30min
      }),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error('Erro MP Pix:', JSON.stringify(mpData));
      return new Response(JSON.stringify({ error: 'Erro ao criar pagamento Pix', detail: mpData }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const txData = mpData.point_of_interaction?.transaction_data;

    return new Response(JSON.stringify({
      payment_id: mpData.id,
      status: mpData.status,
      qr_code: txData?.qr_code || null,           // copia e cola
      qr_code_base64: txData?.qr_code_base64 || null, // imagem QR
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });

  } catch (err) {
    console.error('mp-create-pix error:', err);
    return new Response(JSON.stringify({ error: 'Falha na comunicação com Mercado Pago' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}
