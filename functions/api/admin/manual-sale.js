/**
 * Cloudflare Pages Function — POST /api/admin/manual-sale
 *
 * Registra manualmente uma venda fechada fora do checkout do site (ex:
 * encomenda de trabalho combinada e paga por WhatsApp/PIX direto), pra ela
 * entrar nas estatísticas do painel Financeiro. Só admin pode chamar.
 * Escreve na tabela sales via service role, já que RLS não libera escrita
 * pra ninguém nessa tabela.
 *
 * Body: { name?, email?, amount, description?, created_at? }
 * Header: Authorization: Bearer <admin_jwt>
 */

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const sbUrl = env.SUPABASE_URL
  const sbKey = env.SUPABASE_SERVICE_KEY

  if (!sbUrl || !sbKey) {
    return new Response(JSON.stringify({ error: 'Config missing' }), { status: 500 })
  }

  const admin = await getAdminUser(request, env)
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }

  let body = {}
  try { body = await request.json() } catch { /* tratado abaixo */ }

  const amount = Number(body.amount)
  if (!amount || amount <= 0) {
    return new Response(JSON.stringify({ error: 'Valor inválido' }), { status: 400 })
  }

  const row = {
    email: (body.email || '').trim() || null,
    name: (body.name || '').trim() || null,
    amount,
    mp_payment_id: `MANUAL-${Date.now()}`,
    mp_status: 'approved',
    status: 'approved',
    description: (body.description || '').trim() || 'Venda registrada manualmente',
    created_at: body.created_at || new Date().toISOString(),
  }

  const res = await fetch(`${sbUrl}/rest/v1/sales`, {
    method: 'POST',
    headers: {
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(JSON.stringify({ error: err }), { status: 500 })
  }

  const data = await res.json()
  return new Response(JSON.stringify({ ok: true, sale: Array.isArray(data) ? data[0] : data }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

// Valida o JWT (header Authorization) e confirma is_admin no Supabase.
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
      `${env.SUPABASE_URL}/rest/v1/approved_users?user_id=eq.${u.id}&select=is_admin`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    )
    if (!pres.ok) return null
    const rows = await pres.json()
    return (Array.isArray(rows) && rows[0] && rows[0].is_admin === true) ? u : null
  } catch {
    return null
  }
}
