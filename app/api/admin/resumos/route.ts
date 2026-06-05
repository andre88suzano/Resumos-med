import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function isAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ?? false
}

export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, subject, semester, slug, html_content } = body

  const admin = createAdminClient()
  // Inserir sem retornar html_content (evita payload enorme na resposta)
  const { data: resumo, error } = await admin
    .from('resumos')
    .insert({ title, subject, semester, slug, html_content })
    .select('id, title, subject, semester, slug')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resumo })
}

export async function DELETE(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { resumoId } = await req.json()
  const admin = createAdminClient()
  const { error } = await admin.from('resumos').delete().eq('id', resumoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
