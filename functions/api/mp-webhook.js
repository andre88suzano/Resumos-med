/**
 * Cloudflare Pages Function — POST /api/mp-webhook
 *
 * Recebe notificações do Mercado Pago (IPN/Webhooks).
 * Quando um pagamento é aprovado:
 *   1. Busca detalhes do pagamento na API do MP
 *   2. Extrai external_reference no formato "{compra_id}:{user_id}:{tipo}"
 *   3. Atualiza compra_participantes no Supabase
 *   4. Incrementa slots_preenchidos em compras_coletivas
 *   5. Se slots completos → status='completo' e libera acesso
 *
 * Variáveis de ambiente necessárias (Cloudflare Pages → Settings → Environment variables):
 *   MP_ACCESS_TOKEN      → Token do Mercado Pago
 *   SUPABASE_URL         → https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY → Service Role Key (com permissão de escrita sem RLS)
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Allow': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature, X-Request-Id',
      },
    });
  }

  // Mercado Pago envia GET para verificar o endpoint — responder 200
  if (request.method === 'GET') {
    return new Response('OK', { status: 200 });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // O MP envia tipo "payment" com o ID do pagamento
  const { type, data } = body;

  if (type !== 'payment' || !data?.id) {
    // Outros tipos de notificação — ignorar com 200 para MP não reenviar
    return new Response('OK', { status: 200 });
  }

  const paymentId = data.id;
  const mpToken = env.MP_ACCESS_TOKEN;
  const sbUrl = env.SUPABASE_URL;
  const sbKey = env.SUPABASE_SERVICE_KEY;

  if (!mpToken || !sbUrl || !sbKey) {
    console.error('Variáveis de ambiente não configuradas');
    return new Response('Config error', { status: 500 });
  }

  try {
    // 1. Buscar detalhes do pagamento
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` },
    });

    if (!payRes.ok) {
      console.error('Erro ao buscar pagamento:', paymentId);
      return new Response('MP fetch error', { status: 502 });
    }

    const payment = await payRes.json();

    if (payment.status !== 'approved') {
      console.log(`Pagamento ${paymentId} com status: ${payment.status}`);
      return new Response('OK', { status: 200 });
    }

    // Idempotência — verificar se este payment_id já foi processado
    const checkRes = await fetch(
      `${sbUrl}/rest/v1/compra_participantes?mp_payment_id=eq.${String(paymentId)}&status_pagamento=eq.aprovado&select=user_id`,
      { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` } }
    );
    const already = await checkRes.json();
    if (Array.isArray(already) && already.length > 0) {
      console.log(`Pagamento ${paymentId} já processado — ignorando reenvio.`);
      return new Response('OK', { status: 200 });
    }

    // 2. Extrair external_reference
    const ref = payment.external_reference || '';
    const parts = ref.split(':');
    if (parts.length < 3) {
      console.error('external_reference inválido:', ref);
      return new Response('OK', { status: 200 });
    }

    const [compra_id, user_id, tipo] = parts;
    const mp_payment_id = String(paymentId);
    const valor_pago = payment.transaction_amount;
    const pago_em = new Date().toISOString();

    // 3. Atualizar compra_participantes
    const updateParticipante = await fetch(
      `${sbUrl}/rest/v1/compra_participantes?compra_id=eq.${compra_id}&user_id=eq.${user_id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          status_pagamento: 'aprovado',
          mp_payment_id,
          valor_pago,
          pago_em,
        }),
      }
    );

    if (!updateParticipante.ok) {
      const err = await updateParticipante.text();
      console.error('Erro ao atualizar participante:', err);
    }

    // 4. Buscar estado atual da compra coletiva
    const compraRes = await fetch(
      `${sbUrl}/rest/v1/compras_coletivas?id=eq.${compra_id}&select=*`,
      {
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`,
        },
      }
    );

    const compras = await compraRes.json();
    const compra = compras?.[0];

    if (!compra) {
      console.error('Compra não encontrada:', compra_id);
      return new Response('OK', { status: 200 });
    }

    const novosSlots = (compra.slots_preenchidos || 0) + 1;

    // 5. Atualizar slots_preenchidos — sala nunca fecha, fica aberta para novos participantes
    await fetch(`${sbUrl}/rest/v1/compras_coletivas?id=eq.${compra_id}`, {
      method: 'PATCH',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ slots_preenchidos: novosSlots }),
    });

    // 6. Liberar acesso imediatamente para quem pagou
    // Cada participante (criador ou joiner) paga e libera seu próprio acesso
    await liberarAcessoParticipante(sbUrl, sbKey, compra_id, user_id);

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('Webhook error:', err);
    // Retornar 200 para o MP não reenviar infinitamente
    return new Response('OK', { status: 200 });
  }
}

/**
 * Libera acesso aos resumos APENAS para o participante que acabou de pagar.
 * Cada participante libera seus próprios resumos ao pagar — sem depender dos outros.
 * Os resumos liberados são EXATAMENTE os que ele selecionou (resumos_selecionados).
 */
async function liberarAcessoParticipante(sbUrl, sbKey, compra_id, user_id) {
  try {
    // Buscar os resumos selecionados por ESTE participante específico
    const partRes = await fetch(
      `${sbUrl}/rest/v1/compra_participantes?compra_id=eq.${compra_id}&user_id=eq.${user_id}&status_pagamento=eq.aprovado&select=user_id,resumos_selecionados`,
      {
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`,
        },
      }
    );

    const participantes = await partRes.json();
    if (!Array.isArray(participantes) || participantes.length === 0) {
      console.log(`Participante ${user_id} não encontrado ou não aprovado.`);
      return;
    }

    const part = participantes[0];
    const resumos = Array.isArray(part.resumos_selecionados)
      ? part.resumos_selecionados
      : [];

    if (resumos.length === 0) {
      console.log(`Participante ${user_id} não tem resumos selecionados.`);
      return;
    }

    // INSERT em user_access com expiração de 50 dias
    // Libera APENAS os resumos que este participante escolheu — sem misturar com outros
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 50 * 86400000).toISOString();
    const rows = resumos.map(resumo_id => ({
      user_id: part.user_id,
      resumo_id,
      granted_at: now.toISOString(),
      expires_at: expiresAt,
    }));

    const insertRes = await fetch(`${sbUrl}/rest/v1/user_access`, {
      method: 'POST',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('Erro ao inserir user_access:', err);
    } else {
      console.log(`Acesso liberado para ${user_id}: ${resumos.length} resumo(s).`);
    }
  } catch (err) {
    console.error('Erro ao liberar acesso do participante:', err);
  }
}
