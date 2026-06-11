/**
 * Cloudflare Pages Function — GET /api/admin/sales
 * Retorna dados de vendas para o painel admin.
 */

function getWeekStart() {
  const now = new Date()
  const diff = now.getDate() - now.getDay()
  const sunday = new Date(now)
  sunday.setDate(diff)
  sunday.setHours(0, 0, 0, 0)
  return sunday.toISOString()
}

function getMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

function getYearStart() {
  return new Date(new Date().getFullYear(), 0, 1).toISOString()
}

async function sbFetch(url, sbKey) {
  const res = await fetch(url, {
    headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
  })
  if (!res.ok) return []
  return res.json()
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const sbUrl = env.SUPABASE_URL
  const sbKey = env.SUPABASE_SERVICE_KEY

  if (!sbUrl || !sbKey) {
    return new Response(JSON.stringify({ error: 'Config error' }), { status: 500 })
  }

  // Exige admin — antes este endpoint era público e vazava faturamento + e-mails de clientes
  const admin = await getAdminUser(request, env)
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }

  const weekStart = getWeekStart()
  const monthStart = getMonthStart()
  const yearStart = getYearStart()

  const [
    weeklySales,
    monthlySales,
    yearlySales,
    allSales,
    abandonedCheckouts,
    compraParticipantes,
  ] = await Promise.all([
    sbFetch(`${sbUrl}/rest/v1/sales?select=id,amount&status=eq.approved&created_at=gte.${weekStart}`, sbKey),
    sbFetch(`${sbUrl}/rest/v1/sales?select=id,amount&status=eq.approved&created_at=gte.${monthStart}`, sbKey),
    sbFetch(`${sbUrl}/rest/v1/sales?select=id,amount&status=eq.approved&created_at=gte.${yearStart}`, sbKey),
    sbFetch(`${sbUrl}/rest/v1/sales?select=id,email,name,amount,mp_payment_id,mp_status,description,created_at&order=created_at.desc&limit=50`, sbKey),
    sbFetch(`${sbUrl}/rest/v1/checkout_attempts?select=id,email,name,preference_id,created_at&converted=eq.false&order=created_at.desc&limit=50`, sbKey),
    sbFetch(`${sbUrl}/rest/v1/compra_participantes?select=id,email,valor_pago,mp_payment_id,pago_em,compra_id&status_pagamento=eq.aprovado&order=pago_em.desc&limit=50`, sbKey),
  ])

  // Buscar compras_coletivas separadamente
  const compraIds = [...new Set(compraParticipantes.map(cp => cp.compra_id).filter(Boolean))]
  let comprasColetivas = []
  if (compraIds.length > 0) {
    comprasColetivas = await sbFetch(
      `${sbUrl}/rest/v1/compras_coletivas?select=id,codigo,preco_individual,preco_dupla,tipo&id=in.(${compraIds.join(',')})`,
      sbKey
    )
  }

  const comprasMap = new Map(comprasColetivas.map(c => [c.id, c]))

  const salesFromCompras = compraParticipantes.map(cp => {
    const compra = comprasMap.get(cp.compra_id)
    const amount = cp.valor_pago ?? compra?.preco_individual ?? 0
    return {
      id: cp.id,
      email: cp.email,
      name: null,
      amount,
      mp_payment_id: cp.mp_payment_id,
      mp_status: 'approved',
      description: compra
        ? `Plano ${compra.tipo === 'dupla' ? 'Amigo' : 'Solo'} — Sala ${compra.codigo}`
        : 'Compra Coletiva',
      created_at: cp.pago_em,
      source: 'compra_participantes',
    }
  })

  const salesMpIds = new Set(allSales.map(s => s.mp_payment_id).filter(Boolean))
  const uniqueSalesFromCompras = salesFromCompras.filter(s => !s.mp_payment_id || !salesMpIds.has(s.mp_payment_id))

  const mergedSales = [
    ...allSales.map(s => ({ ...s, source: 'sales' })),
    ...uniqueSalesFromCompras,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const comprasWeekly = uniqueSalesFromCompras.filter(s => s.created_at >= weekStart)
  const comprasMonthly = uniqueSalesFromCompras.filter(s => s.created_at >= monthStart)
  const comprasYearly = uniqueSalesFromCompras.filter(s => s.created_at >= yearStart)

  const sum = arr => arr.reduce((s, r) => s + Number(r.amount), 0)

  return new Response(JSON.stringify({
    counts: {
      weekly: weeklySales.length + comprasWeekly.length,
      monthly: monthlySales.length + comprasMonthly.length,
      yearly: yearlySales.length + comprasYearly.length,
    },
    revenue: {
      weekly: sum(weeklySales) + sum(comprasWeekly),
      monthly: sum(monthlySales) + sum(comprasMonthly),
      yearly: sum(yearlySales) + sum(comprasYearly),
    },
    sales: mergedSales,
    abandoned: abandonedCheckouts,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

// Valida o JWT (header Authorization) e confirma is_admin no Supabase.
// Retorna o user admin ou null.
async function getAdminUser(request, env) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try {
    const ures = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!ures.ok) return null
    const u = await ures.json()
    if (!u || !u.id) return null
    const pres = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${u.id}&select=is_admin`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    )
    if (!pres.ok) return null
    const rows = await pres.json()
    return (Array.isArray(rows) && rows[0] && rows[0].is_admin === true) ? u : null
  } catch {
    return null
  }
}
