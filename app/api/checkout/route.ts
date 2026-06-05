import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

export async function POST(req: Request) {
  const { email, name } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 })
  }

  const pref = await new Preference(mp).create({
    body: {
      items: [
        {
          id: 'resumos-med-acesso',
          title: 'Acesso Resumos Med',
          quantity: 1,
          unit_price: 49.90,
          currency_id: 'BRL',
        },
      ],
      payer: { email, name },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_URL}/obrigado`,
        failure: `${process.env.NEXT_PUBLIC_URL}/checkout`,
        pending: `${process.env.NEXT_PUBLIC_URL}/checkout`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_URL}/api/webhook/mercadopago`,
    },
  })

  const admin = createAdminClient()
  await admin.from('checkout_attempts').insert({
    email,
    name: name ?? null,
    preference_id: pref.id,
    converted: false,
  })

  return NextResponse.json({ init_point: pref.init_point })
}
