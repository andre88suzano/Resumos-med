'use client'

import { useState, useEffect } from 'react'

type Profile = { id: string; name: string | null; email: string; approved: boolean; is_admin: boolean }
type Resumo = { id: string; title: string; subject: string; semester: string; slug: string }
type Permission = { user_id: string; resumo_id: string }

type Sale = {
  id: string
  email: string
  name: string | null
  amount: number
  mp_payment_id: string | null
  mp_status: string
  status: string
  description: string | null
  created_at: string
}

type CheckoutAttempt = {
  id: string
  email: string | null
  name: string | null
  preference_id: string | null
  created_at: string
}

type SalesData = {
  counts: { weekly: number; monthly: number; yearly: number }
  revenue: { weekly: number; monthly: number; yearly: number }
  sales: Sale[]
  abandoned: CheckoutAttempt[]
}

interface Props {
  users: Profile[]
  resumos: Resumo[]
  permissions: Permission[]
}

// Estrutura de semestres e matérias — deve ser idêntica à do dashboard
const ESTRUTURA: Record<string, string[]> = {
  'Terceiro Semestre': ['Microbiologia', 'Imunologia', 'Biofísica', 'Bioquímica', 'Fisiologia', 'Genética'],
}

export default function AdminPanel({ users: initialUsers, resumos: initialResumos, permissions: initialPerms }: Props) {
  const [tab, setTab] = useState<'users' | 'resumos' | 'perms' | 'sales'>('users')
  const [salesData, setSalesData] = useState<SalesData | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)

  function fetchSales() {
    setSalesLoading(true)
    fetch('/api/admin/sales')
      .then(r => r.json())
      .then(d => {
        console.log('[admin/sales] response:', JSON.stringify(d).slice(0, 300))
        setSalesData(d)
        setSalesLoading(false)
      })
      .catch(err => {
        console.error('[admin/sales] error:', err)
        setSalesLoading(false)
      })
  }

  useEffect(() => {
    if (tab !== 'sales' || salesData) return
    fetchSales()
  }, [tab, salesData])
  const [users, setUsers] = useState(initialUsers)
  const [resumos, setResumos] = useState(initialResumos)
  const [perms, setPerms] = useState(initialPerms)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  // Formulário de novo resumo
  const [form, setForm] = useState({ title: '', subject: '', semester: '', slug: '', html: '' })
  const [fileName, setFileName] = useState('')

  // Matérias disponíveis para o semestre selecionado
  const materiasDisponiveis = form.semester ? (ESTRUTURA[form.semester] ?? []) : []

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setForm(f => ({ ...f, html: content }))
    }
    reader.readAsText(file, 'UTF-8')
  }

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  async function approveUser(userId: string, approve: boolean) {
    setLoading(userId)
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, approve }),
    })
    if (res.ok) {
      setUsers(u => u.map(p => p.id === userId ? { ...p, approved: approve } : p))
      flash(approve ? 'Usuário aprovado!' : 'Usuário suspenso.')
    }
    setLoading(null)
  }

  async function togglePerm(userId: string, resumoId: string) {
    const has = perms.some(p => p.user_id === userId && p.resumo_id === resumoId)
    const res = await fetch('/api/admin/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, resumoId, grant: !has }),
    })
    if (res.ok) {
      setPerms(prev =>
        has
          ? prev.filter(p => !(p.user_id === userId && p.resumo_id === resumoId))
          : [...prev, { user_id: userId, resumo_id: resumoId }]
      )
    }
  }

  async function addResumo(e: React.FormEvent) {
    e.preventDefault()
    setLoading('add')
    const res = await fetch('/api/admin/resumos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        subject: form.subject,
        semester: form.semester,
        slug: form.slug || form.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        html_content: form.html,
      }),
    })
    if (res.ok) {
      const { resumo } = await res.json()
      setResumos(r => [...r, resumo])
      setForm({ title: '', subject: '', semester: '', slug: '', html: '' })
      flash('Resumo adicionado com sucesso!')
    } else {
      flash('Erro ao adicionar resumo.')
    }
    setLoading(null)
  }

  async function deleteResumo(resumoId: string) {
    if (!confirm('Deletar este resumo?')) return
    const res = await fetch('/api/admin/resumos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumoId }),
    })
    if (res.ok) {
      setResumos(r => r.filter(x => x.id !== resumoId))
      setPerms(p => p.filter(x => x.resumo_id !== resumoId))
      flash('Resumo removido.')
    }
  }

  const tabStyle = (active: boolean) => ({
    padding: '14px 24px',
    fontFamily: 'Trebuchet MS, sans-serif',
    fontSize: '.8rem',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    color: active ? 'var(--accent1)' : 'var(--text2)',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '3px solid var(--accent1)' : '3px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  })

  const inputStyle = {
    width: '100%',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'var(--text)',
    fontSize: '.88rem',
    outline: 'none',
    fontFamily: 'Trebuchet MS, sans-serif',
  }

  const pendingUsers = users.filter(u => !u.approved && !u.is_admin)
  const approvedUsers = users.filter(u => u.approved || u.is_admin)

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg2) 100%)',
        borderBottom: '2px solid var(--gold)',
        padding: '24px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: 'var(--gold)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.65rem', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
            Painel Admin
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '1.6rem', color: '#fff', margin: 0 }}>
            Resumos Med
          </h1>
        </div>
        <a href="/dashboard" style={{
          color: 'var(--text2)',
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '.8rem',
          textDecoration: 'none',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          ← Dashboard
        </a>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', overflowX: 'auto', padding: '0 24px' }}>
        <button style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>
          Usuários {pendingUsers.length > 0 && <span style={{ background: 'var(--accent2)', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '.65rem', marginLeft: '6px' }}>{pendingUsers.length}</span>}
        </button>
        <button style={tabStyle(tab === 'resumos')} onClick={() => setTab('resumos')}>
          Resumos ({resumos.length})
        </button>
        <button style={tabStyle(tab === 'perms')} onClick={() => setTab('perms')}>
          Permissões
        </button>
        <button style={tabStyle(tab === 'sales')} onClick={() => setTab('sales')}>
          Vendas
        </button>
      </div>

      {/* Flash msg */}
      {msg && (
        <div style={{ background: 'rgba(129,199,132,.1)', border: '1px solid rgba(129,199,132,.3)', borderLeft: '4px solid var(--accent3)', margin: '16px 30px', padding: '12px 20px', borderRadius: '8px', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.875rem', color: 'var(--accent3)' }}>
          {msg}
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 30px 80px' }}>

        {/* ── TAB: USUÁRIOS ── */}
        {tab === 'users' && (
          <div>
            {pendingUsers.length > 0 && (
              <>
                <h3 style={{ fontFamily: 'Georgia, serif', color: 'var(--accent2)', fontSize: '1.1rem', marginBottom: '16px' }}>
                  Aguardando aprovação ({pendingUsers.length})
                </h3>
                {pendingUsers.map(u => (
                  <div key={u.id} style={{ background: 'var(--card)', border: '1px solid rgba(240,98,146,.3)', borderRadius: '10px', padding: '18px 24px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: '1rem' }}>{u.name ?? '—'}</div>
                      <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.82rem', marginTop: '4px' }}>{u.email}</div>
                    </div>
                    <button
                      disabled={loading === u.id}
                      onClick={() => approveUser(u.id, true)}
                      style={{ background: 'rgba(129,199,132,.15)', border: '1px solid var(--accent3)', borderRadius: '8px', color: 'var(--accent3)', padding: '8px 20px', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.8rem', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}
                    >
                      {loading === u.id ? '...' : 'Aprovar'}
                    </button>
                  </div>
                ))}
                <div style={{ height: '32px' }} />
              </>
            )}

            <h3 style={{ fontFamily: 'Georgia, serif', color: 'var(--accent3)', fontSize: '1.1rem', marginBottom: '16px' }}>
              Usuários aprovados ({approvedUsers.length})
            </h3>
            {approvedUsers.length === 0 && <p style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.9rem' }}>Nenhum usuário aprovado ainda.</p>}
            {approvedUsers.map(u => (
              <div key={u.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px 24px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: '1rem' }}>{u.name ?? '—'}</span>
                    {u.is_admin && <span style={{ background: 'rgba(255,213,79,.15)', color: 'var(--gold)', border: '1px solid rgba(255,213,79,.3)', borderRadius: '10px', padding: '1px 8px', fontSize: '.65rem', fontFamily: 'Trebuchet MS, sans-serif', letterSpacing: '1px' }}>ADMIN</span>}
                  </div>
                  <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.82rem', marginTop: '4px' }}>{u.email}</div>
                </div>
                {!u.is_admin && (
                  <button
                    disabled={loading === u.id}
                    onClick={() => approveUser(u.id, false)}
                    style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', padding: '8px 20px', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.75rem', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}
                  >
                    Suspender
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: RESUMOS ── */}
        {tab === 'resumos' && (
          <div>
            <h3 style={{ fontFamily: 'Georgia, serif', color: '#fff', fontSize: '1.2rem', marginBottom: '24px' }}>Adicionar resumo</h3>

            <form onSubmit={addResumo} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px', marginBottom: '40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.7rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Título</label>
                  <input style={inputStyle} required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Bactérias Gram Positivas" />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.7rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Semestre</label>
                  <select
                    style={inputStyle}
                    required
                    value={form.semester}
                    onChange={e => setForm(f => ({ ...f, semester: e.target.value, subject: '' }))}
                  >
                    <option value="">Selecione o semestre…</option>
                    {Object.keys(ESTRUTURA).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.7rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Matéria</label>
                  <select
                    style={inputStyle}
                    required
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    disabled={materiasDisponiveis.length === 0}
                  >
                    <option value="">{form.semester ? 'Selecione a matéria…' : 'Escolha o semestre primeiro'}</option>
                    {materiasDisponiveis.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.7rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Slug (URL)</label>
                  <input style={inputStyle} value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="Ex: bacterias-gram-pos (opcional)" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.7rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>HTML do resumo</label>

                {/* Botão de upload de arquivo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'linear-gradient(90deg, var(--accent2), var(--accent1))',
                    color: '#fff', borderRadius: '8px', padding: '9px 18px',
                    fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.8rem',
                    letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
                    flexShrink: 0,
                  }}>
                    📂 Selecionar arquivo .html
                    <input type="file" accept=".html,text/html" style={{ display: 'none' }} onChange={handleFileUpload} />
                  </label>
                  {fileName ? (
                    <span style={{ fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.82rem', color: 'var(--accent3)' }}>
                      ✓ <b>{fileName}</b> — {Math.round(form.html.length / 1024)} KB carregados
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.8rem', color: 'var(--text2)' }}>
                      ou cole o HTML abaixo
                    </span>
                  )}
                </div>

                {/* Textarea (cole o HTML manualmente ou veja confirmação do arquivo) */}
                <textarea
                  style={{ ...inputStyle, minHeight: '160px', resize: 'vertical', fontSize: '.8rem' }}
                  required
                  value={form.html}
                  onChange={e => { setForm(f => ({ ...f, html: e.target.value })); setFileName('') }}
                  placeholder="Cole o HTML completo aqui, ou use o botão acima para selecionar o arquivo..."
                />
              </div>
              <button
                type="submit"
                disabled={loading === 'add'}
                style={{ background: 'linear-gradient(90deg, var(--accent2), var(--accent1))', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.85rem', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start', paddingLeft: '32px', paddingRight: '32px' }}
              >
                {loading === 'add' ? 'Salvando...' : 'Adicionar Resumo'}
              </button>
            </form>

            <h3 style={{ fontFamily: 'Georgia, serif', color: '#fff', fontSize: '1.2rem', marginBottom: '16px' }}>Resumos cadastrados ({resumos.length})</h3>
            {resumos.length === 0 && <p style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.9rem' }}>Nenhum resumo cadastrado ainda.</p>}
            {resumos.map(r => (
              <div key={r.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 24px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: '1rem' }}>{r.title}</div>
                  <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.8rem', marginTop: '4px' }}>
                    <span style={{ color: 'var(--accent2)' }}>{r.subject}</span> · {r.semester} · <span style={{ color: 'var(--accent1)' }}>/resumos/{r.slug}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteResumo(r.id)}
                  style={{ background: 'transparent', border: '1px solid rgba(239,83,80,.3)', borderRadius: '8px', color: '#ef9a9a', padding: '6px 16px', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.75rem', cursor: 'pointer' }}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: VENDAS ── */}
        {tab === 'sales' && (
          <div>
            {salesLoading && (
              <p style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.9rem' }}>Carregando dados de vendas…</p>
            )}

            {salesData && (
              <>
                {/* Cards de contagem */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                  {[
                    { label: 'Esta semana', count: salesData.counts.weekly, revenue: salesData.revenue.weekly, sub: 'Reseta todo domingo' },
                    { label: 'Este mês', count: salesData.counts.monthly, revenue: salesData.revenue.monthly, sub: 'Reseta no 1º do mês' },
                    { label: 'Este ano', count: salesData.counts.yearly, revenue: salesData.revenue.yearly, sub: 'Reseta em 1º de janeiro' },
                  ].map(({ label, count, revenue, sub }) => (
                    <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
                      <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.7rem', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>{label}</div>
                      <div style={{ color: 'var(--accent1)', fontFamily: 'Georgia, serif', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1 }}>{count}</div>
                      <div style={{ color: 'var(--accent3)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.95rem', marginTop: '6px' }}>
                        R$ {revenue.toFixed(2).replace('.', ',')}
                      </div>
                      <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.72rem', marginTop: '8px', opacity: 0.6 }}>{sub}</div>
                    </div>
                  ))}
                  <div style={{ background: 'linear-gradient(135deg, rgba(79,195,247,.12), rgba(240,98,146,.08))', border: '1px solid var(--accent1)', borderRadius: '12px', padding: '24px' }}>
                    <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.7rem', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Abandono de checkout</div>
                    <div style={{ color: 'var(--accent2)', fontFamily: 'Georgia, serif', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1 }}>{salesData.abandoned.length}</div>
                    <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.82rem', marginTop: '6px' }}>não finalizaram</div>
                  </div>
                </div>

                {/* Vendas recentes */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'Georgia, serif', color: '#fff', fontSize: '1.1rem', margin: 0 }}>
                    Vendas no Mercado Pago ({salesData.sales.length})
                  </h3>
                  <button
                    onClick={() => { setSalesData(null); fetchSales() }}
                    disabled={salesLoading}
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', padding: '7px 16px', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.78rem', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    {salesLoading ? '...' : '↺ Atualizar'}
                  </button>
                </div>
                {salesData.sales.length === 0 ? (
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '24px', color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.9rem', marginBottom: '32px' }}>
                    Nenhuma venda registrada ainda.
                  </div>
                ) : (
                  <div style={{ marginBottom: '40px' }}>
                    {/* Cabeçalho */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr .7fr .7fr .7fr .55fr', gap: '8px', padding: '8px 16px', color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.7rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      <span>Cliente</span><span>Descrição</span><span>Bruto</span><span>Líquido (−1%)</span><span>ID MP</span><span>Data</span>
                    </div>
                    {salesData.sales.map(s => {
                      const gross = Number(s.amount)
                      const net = gross * 0.99
                      return (
                      <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr .7fr .7fr .7fr .55fr', gap: '8px', padding: '14px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '8px', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: '.95rem' }}>{s.name ?? '—'}</div>
                          <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.78rem', marginTop: '2px' }}>{s.email}</div>
                        </div>
                        <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.82rem' }}>{s.description ?? '—'}</div>
                        <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.88rem' }}>
                          R$ {gross.toFixed(2).replace('.', ',')}
                        </div>
                        <div style={{ color: 'var(--accent3)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.9rem', fontWeight: 600 }}>
                          R$ {net.toFixed(2).replace('.', ',')}
                        </div>
                        <div style={{ color: 'var(--accent1)', fontFamily: 'monospace', fontSize: '.78rem' }}>{s.mp_payment_id ?? '—'}</div>
                        <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.78rem' }}>
                          {new Date(s.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    )})}
                  </div>
                )}

                {/* Abandonos de checkout */}
                <h3 style={{ fontFamily: 'Georgia, serif', color: '#fff', fontSize: '1.1rem', marginBottom: '16px' }}>
                  Entraram no checkout mas não finalizaram ({salesData.abandoned.length})
                </h3>
                {salesData.abandoned.length === 0 ? (
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '24px', color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.9rem' }}>
                    Nenhum abandono registrado.
                  </div>
                ) : (
                  <div>
                    {salesData.abandoned.map(a => (
                      <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr .8fr', gap: '8px', padding: '14px 16px', background: 'rgba(240,98,146,.05)', border: '1px solid rgba(240,98,146,.2)', borderRadius: '10px', marginBottom: '8px', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: '.95rem' }}>{a.name ?? '—'}</div>
                          <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.78rem', marginTop: '2px' }}>{a.email ?? '—'}</div>
                        </div>
                        <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.78rem', wordBreak: 'break-all' }}>
                          <span style={{ color: 'var(--text2)', fontSize: '.68rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Pref. ID: </span>
                          {a.preference_id ?? '—'}
                        </div>
                        <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.78rem' }}>
                          {new Date(a.created_at).toLocaleDateString('pt-BR')} {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: PERMISSÕES ── */}
        {tab === 'perms' && (
          <div>
            <h3 style={{ fontFamily: 'Georgia, serif', color: '#fff', fontSize: '1.2rem', marginBottom: '8px' }}>Gerenciar permissões</h3>
            <p style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.85rem', marginBottom: '24px' }}>
              Selecione um usuário para gerenciar quais resumos ele pode acessar.
            </p>

            {/* Seletor de usuário */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '32px' }}>
              {approvedUsers.filter(u => !u.is_admin).map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                  style={{
                    background: selectedUser === u.id ? 'rgba(79,195,247,.15)' : 'var(--card)',
                    border: `1px solid ${selectedUser === u.id ? 'var(--accent1)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    color: selectedUser === u.id ? 'var(--accent1)' : 'var(--text2)',
                    padding: '10px 20px',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {u.name ?? u.email}
                </button>
              ))}
            </div>

            {selectedUser && (
              <>
                <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.8rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>
                  Resumos para: <span style={{ color: 'var(--accent1)' }}>{approvedUsers.find(u => u.id === selectedUser)?.name ?? approvedUsers.find(u => u.id === selectedUser)?.email}</span>
                </div>
                {resumos.length === 0 && <p style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.9rem' }}>Nenhum resumo cadastrado ainda.</p>}
                {resumos.map(r => {
                  const granted = perms.some(p => p.user_id === selectedUser && p.resumo_id === r.id)
                  return (
                    <div
                      key={r.id}
                      onClick={() => togglePerm(selectedUser, r.id)}
                      style={{
                        background: granted ? 'rgba(129,199,132,.08)' : 'var(--card)',
                        border: `1px solid ${granted ? 'rgba(129,199,132,.4)' : 'var(--border)'}`,
                        borderRadius: '10px',
                        padding: '16px 24px',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all .2s',
                      }}
                    >
                      <div>
                        <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: '1rem' }}>{r.title}</div>
                        <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.8rem', marginTop: '4px' }}>
                          <span style={{ color: 'var(--accent2)' }}>{r.subject}</span> · {r.semester}
                        </div>
                      </div>
                      <div style={{
                        width: '48px', height: '26px',
                        background: granted ? 'var(--accent3)' : 'var(--border)',
                        borderRadius: '13px',
                        position: 'relative',
                        transition: 'background .2s',
                        flexShrink: 0,
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: granted ? '25px' : '3px',
                          width: '20px', height: '20px',
                          background: '#fff',
                          borderRadius: '50%',
                          transition: 'left .2s',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
