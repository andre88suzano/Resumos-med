import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function ResumoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: resumo } = await supabase
    .from('resumos')
    .select('id, title, subject, semester, html_content')
    .eq('slug', slug)
    .single()

  if (!resumo) notFound()

  // Verificar permissão
  const { data: perm } = await supabase
    .from('resumo_permissions')
    .select('resumo_id')
    .eq('user_id', user.id)
    .eq('resumo_id', resumo.id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, name')
    .eq('id', user.id)
    .single()

  if (!perm && !profile?.is_admin) notFound()

  // Marca d'água: nome + email do usuário em padrão diagonal
  const wmName = profile?.name ?? user.email?.split('@')[0] ?? ''
  const wmEmail = user.email ?? ''
  const wmText = `${wmName}  •  ${wmEmail}`

  // SVG tile repetível (400×180px, texto em diagonal)
  const svgTile = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='180'>
    <text x='210' y='60' text-anchor='middle' dominant-baseline='middle'
      font-family='Arial,sans-serif' font-size='13' font-weight='600' letter-spacing='1'
      fill='rgba(30,30,30,0.055)' transform='rotate(-22 210 60)'>${wmText}</text>
    <text x='210' y='140' text-anchor='middle' dominant-baseline='middle'
      font-family='Arial,sans-serif' font-size='13' font-weight='600' letter-spacing='1'
      fill='rgba(30,30,30,0.055)' transform='rotate(-22 210 140)'>${wmText}</text>
  </svg>`

  const wmUrl = `url("data:image/svg+xml,${encodeURIComponent(svgTile)}")`

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Barra de navegação */}
      <div style={{
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 200,
      }}>
        <Link href="/dashboard" style={{
          color: 'var(--text2)',
          textDecoration: 'none',
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '.8rem',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          ← Dashboard
        </Link>
        <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
        <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.8rem' }}>
          <span style={{ color: 'var(--accent2)' }}>{resumo.subject}</span>
          {' · '}
          <span>{resumo.semester}</span>
        </div>
      </div>

      {/* Container relativo para sobrepor a marca d'água */}
      <div style={{ position: 'relative', flex: 1 }}>
        <iframe
          srcDoc={resumo.html_content}
          title={resumo.title}
          style={{
            border: 'none',
            width: '100%',
            height: 'calc(100vh - 49px)',
            display: 'block',
          }}
          sandbox="allow-scripts allow-same-origin"
        />

        {/* Marca d'água — invisível para admin */}
        {!profile?.is_admin && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 100,
              backgroundImage: wmUrl,
              backgroundSize: '420px 180px',
              backgroundRepeat: 'repeat',
            }}
          />
        )}
      </div>
    </div>
  )
}
