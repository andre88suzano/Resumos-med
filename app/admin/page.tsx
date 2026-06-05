import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AdminPanel from './AdminPanel'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  const admin = createAdminClient()

  const [{ data: users }, { data: resumos }, { data: permissions }] = await Promise.all([
    admin.from('profiles').select('id, name, email, approved, is_admin').order('created_at'),
    admin.from('resumos').select('id, title, subject, semester, slug').order('semester').order('subject'),
    admin.from('resumo_permissions').select('user_id, resumo_id'),
  ])

  return (
    <AdminPanel
      users={users ?? []}
      resumos={resumos ?? []}
      permissions={permissions ?? []}
    />
  )
}
