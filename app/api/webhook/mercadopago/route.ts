import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

export async function GET() {
  return new Response('OK', { status: 200 })
}

export async function POST(req: Request) {
  const body = await req.json()

  if (body.type !== 'payment') return NextResponse.json({ ok: true })

  const payment = await new Payment(mp).get({ id: body.data.id })

  if (payment.status !== 'approved') return NextResponse.json({ ok: true })

  const admin = createAdminClient()
  const email = payment.payer?.email ?? ''
  const name = [payment.payer?.first_name, payment.payer?.last_name].filter(Boolean).join(' ') || null

  await admin.from('sales').insert({
    email,
    name,
    amount: payment.transaction_amount,
    mp_payment_id: String(payment.id),
    mp_status: payment.status,
    status: 'approved',
    description: payment.description ?? 'Acesso Resumos Med',
  })

  await admin
    .from('checkout_attempts')
    .update({ converted: true })
    .eq('email', email)
    .eq('converted', false)

  return NextResponse.json({ ok: true })
}
