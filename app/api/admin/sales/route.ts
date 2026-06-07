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
    { data: compraParticipantes },
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
    admin.from('compra_participantes')
      .select('id, email, valor_pago, mp_payment_id, pago_em, compra_id, compras_coletivas(codigo, preco_individual, preco_dupla, tipo)')
      .eq('status_pagamento', 'aprovado')
      .order('pago_em', { ascending: false })
      .limit(50),
  ])

  // Normalizar compra_participantes para o mesmo formato de Sale
  type CompraColetiva = { codigo: string; preco_individual: number; preco_dupla: number | null; tipo: string }
  type CompraRow = {
    id: string
    email: string
    valor_pago: number | null
    mp_payment_id: string | null
    pago_em: string
    compra_id: string
    compras_coletivas: CompraColetiva | CompraColetiva[] | null
  }

  const salesFromCompras = ((compraParticipantes ?? []) as unknown as CompraRow[]).map(cp => {
    const compra = Array.isArray(cp.compras_coletivas) ? cp.compras_coletivas[0] : cp.compras_coletivas
    const amount = cp.valor_pago ?? compra?.preco_individual ?? 0
    return {
      id: cp.id,
      email: cp.email,
      name: null as string | null,
      amount,
      mp_payment_id: cp.mp_payment_id,
      mp_status: 'approved',
      description: compra ? `Plano ${compra.tipo === 'dupla' ? 'Amigo' : 'Solo'} — Sala ${compra.codigo}` : 'Compra Coletiva',
      created_at: cp.pago_em,
      source: 'compra_participantes' as const,
    }
  })

  // Evitar duplicatas: se mp_payment_id já está em sales, não incluir de compra_participantes
  const salesMpIds = new Set((allSales ?? []).map(s => s.mp_payment_id).filter(Boolean))
  const uniqueSalesFromCompras = salesFromCompras.filter(s => !s.mp_payment_id || !salesMpIds.has(s.mp_payment_id))

  const mergedSales = [
    ...(allSales ?? []).map(s => ({ ...s, source: 'sales' as const })),
    ...uniqueSalesFromCompras,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Somar receita de compra_participantes nos períodos
  const comprasWeekly = uniqueSalesFromCompras.filter(s => s.created_at >= weekStart)
  const comprasMonthly = uniqueSalesFromCompras.filter(s => s.created_at >= monthStart)
  const comprasYearly = uniqueSalesFromCompras.filter(s => s.created_at >= yearStart)

  const weeklyRevenue = (weeklySales ?? []).reduce((s, r) => s + Number(r.amount), 0)
    + comprasWeekly.reduce((s, r) => s + Number(r.amount), 0)
  const monthlyRevenue = (monthlySales ?? []).reduce((s, r) => s + Number(r.amount), 0)
    + comprasMonthly.reduce((s, r) => s + Number(r.amount), 0)
  const yearlyRevenue = (yearlySales ?? []).reduce((s, r) => s + Number(r.amount), 0)
    + comprasYearly.reduce((s, r) => s + Number(r.amount), 0)

  return NextResponse.json({
    counts: {
      weekly: (weeklySales?.length ?? 0) + comprasWeekly.length,
      monthly: (monthlySales?.length ?? 0) + comprasMonthly.length,
      yearly: (yearlySales?.length ?? 0) + comprasYearly.length,
    },
    revenue: {
      weekly: weeklyRevenue,
      monthly: monthlyRevenue,
      yearly: yearlyRevenue,
    },
    sales: mergedSales,
    abandoned: abandonedCheckouts ?? [],
  })
}
