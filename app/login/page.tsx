'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForce, setShowForce] = useState(false)

  useEffect(() => {
    if (params.get('blocked') === '1') {
      setError('Sua conta foi acessada em outro dispositivo. Faça login novamente.')
    }
  }, [params])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setShowForce(false)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    // Verificar se já existe sessão ativa em outro dispositivo
    const activateRes = await fetch('/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: false }),
    })
    const activateData = await activateRes.json()

    if (!activateData.authorized) {
      // Sessão ativa em outro dispositivo — mostra opção de forçar
      setShowForce(true)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleForceLogin() {
    setLoading(true)
    // Força o logout do outro dispositivo e entra neste
    const res = await fetch('/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true }),
    })
    const data = await res.json()
    if (data.authorized) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError('Erro ao tentar entrar. Tente novamente.')
      setShowForce(false)
      setLoading(false)
    }
  }

  async function handleCancelForce() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setShowForce(false)
    setError('')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo / Título */}
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
            Bem-vindo de volta
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>
            Acesse seus resumos médicos
          </p>
        </div>

        {/* Card do formulário */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '32px',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.75rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                style={{
                  width: '100%',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: 'var(--text)',
                  fontSize: '.9rem',
                  outline: 'none',
                  fontFamily: 'Trebuchet MS, sans-serif',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent1)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.75rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: 'var(--text)',
                  fontSize: '.9rem',
                  outline: 'none',
                  fontFamily: 'Trebuchet MS, sans-serif',
                }}
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

            {/* Confirmação para forçar logout do outro dispositivo */}
            {showForce && (
              <div style={{
                background: 'rgba(255,193,7,.08)',
                border: '1px solid rgba(255,193,7,.35)',
                borderLeft: '4px solid #ffc107',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'Trebuchet MS, sans-serif',
              }}>
                <div style={{ color: '#ffe082', fontSize: '.88rem', fontWeight: 700, marginBottom: '6px' }}>
                  ⚠️ Conta ativa em outro dispositivo
                </div>
                <div style={{ color: 'var(--text2)', fontSize: '.82rem', marginBottom: '14px', lineHeight: 1.5 }}>
                  Sua conta já está logada em outro dispositivo. Deseja desconectá-lo e entrar aqui?
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleForceLogin}
                    disabled={loading}
                    style={{
                      flex: 1,
                      background: 'rgba(239,83,80,.15)',
                      border: '1px solid rgba(239,83,80,.4)',
                      borderRadius: '8px',
                      color: '#ef9a9a',
                      padding: '10px',
                      fontSize: '.8rem',
                      fontFamily: 'Trebuchet MS, sans-serif',
                      letterSpacing: '.5px',
                      textTransform: 'uppercase',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? '...' : 'Sim, desconectar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForce}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text2)',
                      padding: '10px',
                      fontSize: '.8rem',
                      fontFamily: 'Trebuchet MS, sans-serif',
                      letterSpacing: '.5px',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {!showForce && (
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? 'var(--border)' : 'linear-gradient(90deg, var(--accent2), var(--accent1))',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '.9rem',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'opacity .2s',
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            )}
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text2)', fontSize: '.85rem', fontFamily: 'Trebuchet MS, sans-serif' }}>
            Ainda não tem conta?{' '}
            <Link href="/register" style={{ color: 'var(--accent1)', textDecoration: 'none' }}>
              Solicitar acesso
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
