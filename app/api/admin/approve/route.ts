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

  const { userId, approve } = await req.json()
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ approved: approve }).eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
