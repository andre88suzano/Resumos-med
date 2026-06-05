import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // force=true → desconecta o dispositivo anterior e entra neste
  const body = await req.json().catch(() => ({}))
  const force = body?.force === true

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('active_token, is_admin')
    .eq('id', user.id)
    .single()

  // Admin nunca é bloqueado
  if (!profile?.is_admin && profile?.active_token && !force) {
    // Sessão ativa em outro dispositivo e sem force → bloqueia
    return NextResponse.json({ authorized: false })
  }

  // Primeiro acesso, admin ou force=true: gera novo token (Web Crypto API — funciona em Cloudflare Workers)
  const token = crypto.randomUUID()
  await admin.from('profiles').update({ active_token: token }).eq('id', user.id)

  const response = NextResponse.json({ ok: true, authorized: true })
  response.cookies.set('device_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return response
}
