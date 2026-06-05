import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function isAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ?? false
}

function getWeekStart() {
  const now = new Date()
  const day = now.getDay() // 0 = domingo
  const diff = now.getDate() - day
  const sunday = new Date(now.setDate(diff))
  sunday.setHours(0, 0, 0, 0)
  return sunday.toISOString()
}

function getMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

function getYearStart() {
  const now = new Date()
  return new Date(now.getFullYear(), 0, 1).toISOString()
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const weekStart = getWeekStart()
  const monthStart = getMonthStart()
  const yearStart = getYearStart()

  const [
    { data: weeklySales },
    { data: monthlySales },
    { data: yearlySales },
    { data: allSales },
    { data: abandonedCheckouts },
  ] = await Promise.all([
    admin.from('sales').select('id, amount').eq('status', 'approved').gte('created_at', weekStart),
    admin.from('sales').select('id, amount').eq('status', 'approved').gte('created_at', monthStart),
    admin.from('sales').select('id, amount').eq('status', 'approved').gte('created_at', yearStart),
    admin.from('sales')
      .select('id, email, name, amount, mp_payment_id, mp_status, description, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('checkout_attempts')
      .select('id, email, name, preference_id, created_at')
      .eq('converted', false)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const weeklyRevenue = (weeklySales ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const monthlyRevenue = (monthlySales ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const yearlyRevenue = (yearlySales ?? []).reduce((s, r) => s + Number(r.amount), 0)

  return NextResponse.json({
    counts: {
      weekly: weeklySales?.length ?? 0,
      monthly: monthlySales?.length ?? 0,
      yearly: yearlySales?.length ?? 0,
    },
    revenue: {
      weekly: weeklyRevenue,
      monthly: monthlyRevenue,
      yearly: yearlyRevenue,
    },
    sales: allSales ?? [],
    abandoned: abandonedCheckouts ?? [],
  })
}
