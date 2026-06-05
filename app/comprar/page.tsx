'use client'

import { useState } from 'react'

export default function ComprarPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleComprar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao iniciar pagamento.')
        setLoading(false)
        return
      }

      window.location.href = data.init_point
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px 16px',
    color: 'var(--text)',
    fontSize: '.9rem',
    outline: 'none',
    fontFamily: 'Trebuchet MS, sans-serif',
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(90deg, var(--accent2), var(--accent1))',
            color: '#fff',
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '.7rem',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            padding: '4px 16px',
            borderRadius: '20px',
            marginBottom: '16px',
          }}>Resumos Med</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', color: '#fff', marginBottom: '8px' }}>
            Acesso aos Resumos
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '.9rem', fontFamily: 'Trebuchet MS, sans-serif' }}>
            Acesso completo aos resumos do 3º Semestre
          </p>
        </div>

        {/* Card de preço */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(79,195,247,.08), rgba(240,98,146,.06))',
          border: '1px solid var(--accent1)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          marginBottom: '24px',
        }}>
          <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.75rem', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
            Investimento
          </div>
          <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: '2.8rem', fontWeight: 700 }}>
            R$ 49<span style={{ fontSize: '1.4rem' }}>,90</span>
          </div>
          <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.82rem', marginTop: '8px' }}>
            Pagamento único · Acesso permanente
          </div>
        </div>

        {/* Formulário */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '32px',
        }}>
          <form onSubmit={handleComprar} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.75rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Trebuchet MS, sans-serif' }}>
                Nome completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent1)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.75rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Trebuchet MS, sans-serif' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent1)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,83,80,.1)',
                border: '1px solid rgba(239,83,80,.3)',
                borderLeft: '4px solid #ef5350',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#ef9a9a',
                fontSize: '.85rem',
                fontFamily: 'Trebuchet MS, sans-serif',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? 'var(--border)' : 'linear-gradient(90deg, var(--accent2), var(--accent1))',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '1rem',
                fontFamily: 'Trebuchet MS, sans-serif',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Redirecionando...' : 'Comprar agora'}
            </button>

            <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '.78rem', fontFamily: 'Trebuchet MS, sans-serif' }}>
              Pagamento seguro via Mercado Pago
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
