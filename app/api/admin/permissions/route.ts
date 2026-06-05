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

  const { userId, resumoId, grant } = await req.json()
  const admin = createAdminClient()

  if (grant) {
    const { error } = await admin.from('resumo_permissions').upsert({ user_id: userId, resumo_id: resumoId })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await admin.from('resumo_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('resumo_id', resumoId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
