'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '1.6rem', color: '#fff', marginBottom: '12px' }}>
            Cadastro enviado!
          </h2>
          <p style={{ color: 'var(--text2)', lineHeight: '1.7', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.9rem' }}>
            Seu cadastro foi recebido e está aguardando aprovação.<br />
            Você receberá acesso assim que for liberado.
          </p>
          <Link href="/login" style={{
            display: 'inline-block',
            marginTop: '24px',
            color: 'var(--accent1)',
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '.85rem',
            textDecoration: 'none',
          }}>
            ← Voltar para o login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
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
            Solicitar acesso
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>
            Após o cadastro, aguarde aprovação
          </p>
        </div>

        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '32px',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              { label: 'Nome', value: name, setter: setName, type: 'text', placeholder: 'Seu nome completo' },
              { label: 'Email', value: email, setter: setEmail, type: 'email', placeholder: 'seu@email.com' },
              { label: 'Senha', value: password, setter: setPassword, type: 'password', placeholder: '••••••••' },
            ].map(({ label, value, setter, type, placeholder }) => (
              <div key={label}>
                <label style={{ display: 'block', color: 'var(--text2)', fontSize: '.75rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={value}
                  onChange={e => setter(e.target.value)}
                  required
                  placeholder={placeholder}
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
            ))}

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
                padding: '14px',
                fontSize: '.9rem',
                fontFamily: 'Trebuchet MS, sans-serif',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Cadastrando...' : 'Solicitar Acesso'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text2)', fontSize: '.85rem', fontFamily: 'Trebuchet MS, sans-serif' }}>
            Já tem conta?{' '}
            <Link href="/login" style={{ color: 'var(--accent1)', textDecoration: 'none' }}>
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
