import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  async function logout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '500px' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>⏳</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', color: '#fff', marginBottom: '16px' }}>
          Cadastro em análise
        </h1>
        <p style={{ color: 'var(--text2)', lineHeight: '1.8', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.95rem', marginBottom: '8px' }}>
          Olá{user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ''}! Seu cadastro foi recebido com sucesso.
        </p>
        <p style={{ color: 'var(--text2)', lineHeight: '1.8', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.95rem' }}>
          Assim que for aprovado, você terá acesso aos resumos liberados para a sua conta.
        </p>

        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px 24px',
          marginTop: '32px',
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '.85rem',
          color: 'var(--text2)',
        }}>
          <strong style={{ color: 'var(--accent1)' }}>Email cadastrado:</strong> {user?.email}
        </div>

        <form action={logout} style={{ marginTop: '24px' }}>
          <button
            type="submit"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text2)',
              padding: '10px 24px',
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '.8rem',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  )
}
