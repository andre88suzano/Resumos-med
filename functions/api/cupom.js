/**
 * Cloudflare Pages Function — POST /api/cupom
 *
 * Valida um cupom de desconto no servidor (sem expor a lista de cupons ao cliente)
 * e devolve o preço final. Regra de acúmulo: NÃO acumula com o desconto de volume —
 * usa sempre o desconto que for melhor pro aluno (o menor preço final).
 *
 * Variáveis de ambiente:
 *   SUPABASE_URL          → https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY  → Service Role Key (ignora RLS)
 *
 * Body (JSON):
 *   { codigo: string, subtotal: number, preco_atual: number }
 *     subtotal    → preço SEM nenhum desconto (qtd × unitário, ou o preço cheio)
 *     preco_atual → preço que o aluno pagaria sem cupom (já com desconto de volume)
 *
 * Retorna:
 *   { valido:true,  tipo, valor, preco_final, aplicado, motivo }
 *   { valido:false, motivo }
 */

const ALLOWED_ORIGINS = [
  'https://resumos-med.pages.dev',
  'https://medresumenes.pages.dev',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

const json = (obj, status, origin) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
});

const round2 = v => Math.round(v * 100) / 100;

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return json({ valido: false, motivo: 'Método não permitido' }, 405, origin);
  }

  const sbUrl = env.SUPABASE_URL;
  const sbKey = env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) {
    return json({ valido: false, motivo: 'Configuração do servidor ausente' }, 500, origin);
  }

  let body;
  try { body = await request.json(); } catch { return json({ valido: false, motivo: 'Body inválido' }, 400, origin); }

  const codigo = String(body.codigo || '').trim().toUpperCase();
  const subtotal = parseFloat(body.subtotal);
  const precoAtual = parseFloat(body.preco_atual);

  if (!codigo) return json({ valido: false, motivo: 'Informe um código.' }, 200, origin);
  if (!(subtotal > 0) || !(precoAtual > 0)) {
    return json({ valido: false, motivo: 'Selecione os itens antes de aplicar o cupom.' }, 200, origin);
  }

  try {
    // Busca o cupom (case-insensitive, exato). Service key ignora RLS.
    const res = await fetch(
      `${sbUrl}/rest/v1/cupons?codigo=eq.${encodeURIComponent(codigo)}&select=*&limit=1`,
      { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` } }
    );
    const rows = res.ok ? await res.json() : [];
    const cupom = Array.isArray(rows) ? rows[0] : null;

    if (!cupom)        return json({ valido: false, motivo: 'Cupom não encontrado.' }, 200, origin);
    if (!cupom.ativo)  return json({ valido: false, motivo: 'Este cupom não está mais ativo.' }, 200, origin);
    if (cupom.expira_em && new Date(cupom.expira_em) < new Date()) {
      return json({ valido: false, motivo: 'Cupom expirado.' }, 200, origin);
    }
    if (cupom.max_usos != null && (cupom.usos || 0) >= cupom.max_usos) {
      return json({ valido: false, motivo: 'Cupom esgotado.' }, 200, origin);
    }

    // Preço do cupom incide sobre o SUBTOTAL (preço cheio, sem desconto de volume).
    const valor = parseFloat(cupom.valor) || 0;
    let precoCupom;
    if (cupom.tipo === 'fixo') {
      precoCupom = Math.max(0, subtotal - valor);
    } else { // percent
      precoCupom = subtotal * (1 - valor / 100);
    }
    precoCupom = round2(precoCupom);

    // NÃO acumula: vence o menor preço entre o cupom e o que ele já pagaria (volume).
    const precoFinal = round2(Math.min(precoAtual, precoCupom));
    const aplicado = precoFinal < precoAtual; // o cupom de fato melhorou o preço?

    return json({
      valido: true,
      tipo: cupom.tipo,
      valor,
      preco_final: precoFinal,
      aplicado,
      motivo: aplicado
        ? 'Cupom aplicado!'
        : 'Seu desconto atual já é melhor que o cupom — mantivemos o menor preço.',
    }, 200, origin);

  } catch (err) {
    return json({ valido: false, motivo: 'Erro ao validar o cupom.' }, 500, origin);
  }
}
