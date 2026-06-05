import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { CopyButton } from './CopyButton'

const PIX_KEY = '18553943755'
const PRECO = 'R$ 15,00'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await import('next/headers').then(m => m.cookies())
  const deviceToken = (await cookieStore).get('device_token')?.value

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, is_admin, approved, active_token')
    .eq('id', user.id)
    .single()

  if (!profile?.approved && !profile?.is_admin) redirect('/pending')

  // Bloquear acesso de dispositivo não autorizado
  if (!profile?.is_admin && profile?.active_token && deviceToken !== profile.active_token) {
    await supabase.auth.signOut()
    redirect('/login?blocked=1')
  }

  // Buscar todos os resumos
  const { data: todosResumos } = await supabase
    .from('resumos')
    .select('id, title, subject, semester, slug')
    .order('semester').order('subject')

  // Buscar permissões do usuário
  const { data: permissions } = await supabase
    .from('resumo_permissions')
    .select('resumo_id')
    .eq('user_id', user.id)

  const resumos = todosResumos ?? []
  const permitidos = new Set((permissions ?? []).map((p: any) => p.resumo_id))

  // Estrutura predefinida de semestres e matérias
  const ESTRUTURA: Record<string, string[]> = {
    'Terceiro Semestre': ['Microbiologia', 'Imunologia', 'Biofísica', 'Bioquímica', 'Fisiologia', 'Genética'],
  }

  // Agrupar por semestre → matéria, começando pelas pastas predefinidas
  type ResumoItem = (typeof resumos)[number]
  const nested: Record<string, Record<string, ResumoItem[]>> = {}

  // Inicializar pastas predefinidas (aparecem mesmo vazias)
  for (const [sem, materias] of Object.entries(ESTRUTURA)) {
    nested[sem] = {}
    for (const mat of materias) nested[sem][mat] = []
  }

  // Preencher com resumos do banco
  for (const r of resumos) {
    if (!nested[r.semester]) nested[r.semester] = {}
    if (!nested[r.semester][r.subject]) nested[r.semester][r.subject] = []
    nested[r.semester][r.subject].push(r)
  }

  const semesters = Object.keys(nested).sort()

  async function logout() {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Limpa o token ativo para liberar outro dispositivo entrar
      const admin = createAdminClient()
      await admin.from('profiles').update({ active_token: null }).eq('id', user.id)
    }
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg2) 100%)',
        borderBottom: '2px solid var(--accent1)',
        padding: '24px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(90deg, var(--accent2), var(--accent1))',
            color: '#fff',
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '.65rem',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            padding: '3px 12px',
            borderRadius: '20px',
            marginBottom: '8px',
          }}>Resumos Med</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '1.6rem', color: '#fff', margin: 0 }}>
            Olá, {profile?.name ?? user.email?.split('@')[0]}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {profile?.is_admin && (
            <Link href="/admin" style={{
              background: 'rgba(255,213,79,.1)',
              border: '1px solid rgba(255,213,79,.3)',
              borderRadius: '8px',
              color: 'var(--gold)',
              padding: '8px 20px',
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '.75rem',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}>
              Painel Admin
            </Link>
          )}
          <form action={logout}>
            <button style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text2)',
              padding: '8px 20px',
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '.75rem',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}>
              Sair
            </button>
          </form>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 30px 80px' }}>

        {/* Banner de pagamento */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px 32px',
          marginBottom: '48px',
        }}>

          {/* Cabeçalho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span style={{ fontSize: '1rem' }}>💳</span>
            <span style={{ fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.65rem', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent2)' }}>
              Informações de Pagamento
            </span>
          </div>

          {/* Layout principal: esquerda (perfil + pagamento/contato) + direita (valor) */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>

            {/* Coluna esquerda */}
            <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Card de perfil */}
              <div style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}>
                <div style={{
                  width: '48px', height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(79,195,247,.12)',
                  border: '2px solid rgba(79,195,247,.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}>
                  👨‍⚕️
                </div>
                <div>
                  <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.65rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Responsável
                  </div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.05rem', color: '#fff' }}>
                    André Luiz Miranda Suzano
                  </div>
                </div>
              </div>

              {/* Pagamento + Contato lado a lado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                {/* Pagamento */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.82rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>Pagamento</div>
                  <div style={{ width: '36px', height: '2px', background: 'var(--accent1)', marginBottom: '14px', borderRadius: '2px' }} />
                  <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.62rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Chave Pix (CPF)
                  </div>
                  <div style={{ color: '#fff', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.95rem', letterSpacing: '.5px', marginBottom: '12px' }}>
                    18553943755
                  </div>
                  <CopyButton text="18553943755" />
                </div>

                {/* Contato */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.82rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>Contato</div>
                  <div style={{ width: '36px', height: '2px', background: 'var(--accent1)', marginBottom: '14px', borderRadius: '2px' }} />
                  <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.62rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                    WhatsApp
                  </div>
                  <div style={{ color: '#fff', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.95rem', letterSpacing: '.5px', marginBottom: '12px' }}>
                    27 99238-9129
                  </div>
                  <a
                    href="https://wa.me/5527992389129?text=Ol%C3%A1%2C%20Andr%C3%A9.%20Gostaria%20de%20solicitar%20a%20libera%C3%A7%C3%A3o%20do%20meu%20resumo.%20Segue%20em%20anexo%20o%20comprovante%20de%20pagamento%20via%20Pix."
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      background: 'rgba(37,211,102,.12)',
                      border: '1px solid rgba(37,211,102,.4)',
                      borderRadius: '6px',
                      color: '#25d366',
                      padding: '4px 12px',
                      fontSize: '.72rem',
                      fontFamily: 'Trebuchet MS, sans-serif',
                      letterSpacing: '.5px',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Abrir WhatsApp →
                  </a>
                </div>
              </div>
            </div>

            {/* Coluna direita — Valor */}
            <div style={{
              flex: '0 1 180px',
              background: 'var(--bg2)',
              border: '2px solid rgba(79,195,247,.35)',
              borderRadius: '12px',
              padding: '28px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '12px',
            }}>
              <div style={{ color: 'var(--text2)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.65rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Valor por resumo:
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', color: 'var(--accent3)', fontWeight: 700, lineHeight: 1 }}>
                R$ 15,00
              </div>
            </div>
          </div>

          {/* Divisor */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, var(--border), transparent)', marginBottom: '18px' }} />

          {/* Importante */}
          <div style={{ fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.8rem', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
            Importante
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              '⚠️ Não há devolutiva do valor após a liberação do resumo.',
              '‼️ Os resumos são feitos e atualizados de acordo com a aula e o livro da matéria em questão.',
              '❌ Não realize a venda dos resumos presentes na plataforma, pois isso se considera plágio.',
              '✍🏻 Para a liberação envie ao WhatsApp acima: foto do comprovante de pagamento · seu e-mail · o resumo que deseja adquirir.',
            ].map((aviso, i) => (
              <div key={i} style={{ fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.77rem', color: 'var(--text2)', lineHeight: 1.55 }}>
                {aviso}
              </div>
            ))}
          </div>
        </div>

        {semesters.map(semester => (
          <div key={semester} style={{ marginBottom: '56px' }}>

            {/* Cabeçalho do semestre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
              <span style={{
                background: 'var(--accent1)',
                color: '#0a0e1a',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '.65rem',
                fontWeight: 700,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '5px 14px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}>
                📁 {semester}
              </span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--border), transparent)' }} />
            </div>

            {/* Subpastas de matéria */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {Object.entries(nested[semester]).map(([subject, resumosDaMateria]) => (
                <div key={subject}>

                  {/* Cabeçalho da matéria */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingLeft: '4px' }}>
                    <span style={{ fontSize: '1rem' }}>📂</span>
                    <span style={{
                      fontFamily: 'Trebuchet MS, sans-serif',
                      fontSize: '.8rem',
                      fontWeight: 700,
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      color: 'var(--accent2)',
                    }}>
                      {subject}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    <span style={{
                      fontFamily: 'Trebuchet MS, sans-serif',
                      fontSize: '.65rem',
                      color: 'var(--text2)',
                      whiteSpace: 'nowrap',
                    }}>
                      {resumosDaMateria.length} resumo{resumosDaMateria.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Resumos da matéria */}
                  {resumosDaMateria.length === 0 ? (
                    <div style={{
                      background: 'var(--card)',
                      border: '1px dashed var(--border)',
                      borderRadius: '12px',
                      padding: '24px',
                      textAlign: 'center',
                      color: 'var(--text2)',
                      fontFamily: 'Trebuchet MS, sans-serif',
                      fontSize: '.8rem',
                      marginLeft: '28px',
                    }}>
                      Nenhum resumo disponível ainda
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '16px',
                      marginLeft: '28px',
                    }}>
                      {resumosDaMateria.map((r: any) => {
                        const liberado = profile?.is_admin || permitidos.has(r.id)
                        return liberado ? (
                          <Link key={r.id} href={`/resumos/${r.slug}`} className="resumo-card">
                            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '1.05rem', color: '#fff', marginBottom: '16px', lineHeight: '1.4' }}>
                              {r.title}
                            </h3>
                            <div style={{ color: 'var(--accent1)', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.72rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                              Acessar resumo →
                            </div>
                          </Link>
                        ) : (
                          <div key={r.id} style={{
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '20px',
                            opacity: 0.9,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '1.05rem', color: 'var(--text2)', lineHeight: '1.4', margin: 0 }}>
                                {r.title}
                              </h3>
                              <span style={{ fontSize: '.9rem', marginLeft: '8px', flexShrink: 0 }}>🔒</span>
                            </div>
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                              <div style={{ fontFamily: 'Trebuchet MS, sans-serif', fontSize: '1rem', color: 'var(--accent3)', fontWeight: 700, marginBottom: '8px' }}>
                                {PRECO}
                              </div>
                              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontFamily: 'Trebuchet MS, sans-serif', fontSize: '.75rem', color: 'var(--text2)', lineHeight: 1.6 }}>
                                <div style={{ color: 'var(--accent1)', fontWeight: 700, marginBottom: '3px' }}>Chave Pix:</div>
                                <div style={{ color: '#fff', fontSize: '.85rem', letterSpacing: '.5px', marginBottom: '6px' }}>{PIX_KEY}</div>
                                <div style={{ fontSize: '.72rem' }}>Pague e envie o comprovante — seu acesso será liberado em breve.</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
