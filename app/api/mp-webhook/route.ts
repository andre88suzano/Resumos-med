import { NextResponse } from 'next/server'

export async function GET() {
  return new Response('OK', { status: 200 })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Allow': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature, X-Request-Id',
    },
  })
}

export async function POST(req: Request) {
  const mpToken = process.env.MP_ACCESS_TOKEN
  const sbUrl = process.env.SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_KEY

  if (!mpToken || !sbUrl || !sbKey) {
    console.error('Variáveis de ambiente não configuradas')
    return new Response('Config error', { status: 500 })
  }

  let body: { type?: string; data?: { id?: string } }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const { type, data } = body

  if (type !== 'payment' || !data?.id) {
    return new Response('OK', { status: 200 })
  }

  const paymentId = data.id

  try {
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    })

    if (!payRes.ok) {
      console.error('Erro ao buscar pagamento:', paymentId)
      return new Response('MP fetch error', { status: 502 })
    }

    const payment = await payRes.json()

    if (payment.status !== 'approved') {
      return new Response('OK', { status: 200 })
    }

    // Idempotência
    const checkRes = await fetch(
      `${sbUrl}/rest/v1/compra_participantes?mp_payment_id=eq.${String(paymentId)}&status_pagamento=eq.aprovado&select=user_id`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
    )
    const already = await checkRes.json()
    if (Array.isArray(already) && already.length > 0) {
      return new Response('OK', { status: 200 })
    }

    const ref = payment.external_reference || ''
    const parts = ref.split(':')
    if (parts.length < 3) {
      console.error('external_reference inválido:', ref)
      return new Response('OK', { status: 200 })
    }

    const [compra_id, user_id] = parts
    const mp_payment_id = String(paymentId)
    const valor_pago = payment.transaction_amount
    const pago_em = new Date().toISOString()

    await fetch(
      `${sbUrl}/rest/v1/compra_participantes?compra_id=eq.${compra_id}&user_id=eq.${user_id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ status_pagamento: 'aprovado', mp_payment_id, valor_pago, pago_em }),
      }
    )

    const compraRes = await fetch(`${sbUrl}/rest/v1/compras_coletivas?id=eq.${compra_id}&select=*`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
    })
    const compras = await compraRes.json()
    const compra = compras?.[0]

    if (!compra) {
      console.error('Compra não encontrada:', compra_id)
      return new Response('OK', { status: 200 })
    }

    const novosSlots = (compra.slots_preenchidos || 0) + 1
    const estaCompleto = novosSlots >= compra.slots_total

    const compraUpdate: Record<string, unknown> = { slots_preenchidos: novosSlots }

    if (novosSlots === 1 && compra.tipo !== 'solo') {
      compraUpdate.segunda_chance_expira_em = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    }

    if (estaCompleto) {
      compraUpdate.status = 'completo'
    }

    await fetch(`${sbUrl}/rest/v1/compras_coletivas?id=eq.${compra_id}`, {
      method: 'PATCH',
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(compraUpdate),
    })

    if (estaCompleto) {
      await liberarAcessoCompra(sbUrl, sbKey, compra_id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('OK', { status: 200 })
  }
}

async function liberarAcessoCompra(sbUrl: string, sbKey: string, compra_id: string) {
  try {
    const partRes = await fetch(
      `${sbUrl}/rest/v1/compra_participantes?compra_id=eq.${compra_id}&status_pagamento=eq.aprovado&select=user_id,resumos_selecionados`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
    )
    const participantes = await partRes.json()
    if (!Array.isArray(participantes)) return

    for (const part of participantes) {
      const resumos: string[] = Array.isArray(part.resumos_selecionados) ? part.resumos_selecionados : []
      if (resumos.length === 0) continue

      const now = new Date()
      const expiresAt = new Date(now.getTime() + 50 * 86400000).toISOString()
      const rows = resumos.map((resumo_id: string) => ({
        user_id: part.user_id,
        resumo_id,
        granted_at: now.toISOString(),
        expires_at: expiresAt,
      }))

      await fetch(`${sbUrl}/rest/v1/user_access`, {
        method: 'POST',
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify(rows),
      })
    }
  } catch (err) {
    console.error('Erro ao liberar acesso:', err)
  }
}
