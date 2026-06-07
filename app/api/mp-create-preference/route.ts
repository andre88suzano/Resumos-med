import { NextResponse } from 'next/server'

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function POST(req: Request) {
  const mpToken = process.env.MP_ACCESS_TOKEN
  const mpTokenTest = process.env.MP_ACCESS_TOKEN_TEST

  if (!mpToken) {
    return NextResponse.json({ error: 'MP_ACCESS_TOKEN não configurado' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { items, payer_email, external_reference, notification_url, test_mode } = body

  const token = test_mode && mpTokenTest ? mpTokenTest : mpToken

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items é obrigatório' }, { status: 400 })
  }

  const mpPayload = {
    items: items.map((item: any) => ({
      title: item.title || 'MedResúmenes',
      quantity: item.quantity || 1,
      unit_price: parseFloat(item.unit_price),
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
    auto_return: 'approved',
    binary_mode: false,
    statement_descriptor: 'MedResumenes',
    payment_methods: {
      excluded_payment_types: [],
      installments: 12,
    },
  }

  try {
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mpPayload),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      return NextResponse.json(
        { error: 'Erro ao criar preferência no Mercado Pago', detail: mpData },
        { status: 502 }
      )
    }

    return NextResponse.json({
      preference_id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Falha na comunicação com Mercado Pago' }, { status: 500 })
  }
}
