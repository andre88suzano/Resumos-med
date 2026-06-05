'use client'

import Link from 'next/link'

export default function ObrigadoPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🎉</div>
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
          marginBottom: '20px',
        }}>Pagamento confirmado</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2.2rem', color: '#fff', marginBottom: '16px' }}>
          Obrigado pela compra!
        </h1>
        <p style={{ color: 'var(--text2)', lineHeight: '1.8', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.95rem', marginBottom: '32px' }}>
          Seu pagamento foi aprovado. Em breve você receberá o acesso aos resumos por email.
          Caso tenha dúvidas, entre em contato.
        </p>
        <Link href="/login" style={{
          display: 'inline-block',
          background: 'linear-gradient(90deg, var(--accent2), var(--accent1))',
          color: '#fff',
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '.85rem',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          padding: '14px 32px',
          borderRadius: '8px',
          textDecoration: 'none',
        }}>
          Acessar minha conta
        </Link>
      </div>
    </div>
  )
}
