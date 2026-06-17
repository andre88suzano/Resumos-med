-- ─────────────────────────────────────────────────────────
-- CUPONS DE DESCONTO — rode no SQL Editor do Supabase
-- ─────────────────────────────────────────────────────────

-- 1) Tabela de cupons
CREATE TABLE IF NOT EXISTS public.cupons (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     TEXT NOT NULL UNIQUE,              -- ex: CALOURO10 (guardado em MAIÚSCULAS)
  tipo       TEXT NOT NULL DEFAULT 'percent',   -- 'percent' (valor=10 => 10%) ou 'fixo' (valor=10 => R$10)
  valor      NUMERIC(10,2) NOT NULL,            -- o número do desconto
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  expira_em  TIMESTAMPTZ,                       -- NULL = nunca expira
  max_usos   INTEGER,                           -- NULL = ilimitado (ex: 20 = "primeiros 20 alunos")
  usos       INTEGER NOT NULL DEFAULT 0,        -- contador automático (incrementa no pagamento aprovado)
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Coluna pra rastrear qual cupom foi usado em cada compra
ALTER TABLE public.compras_coletivas ADD COLUMN IF NOT EXISTS cupom_codigo TEXT;

-- 3) Segurança: a validação acontece só via Cloudflare Function (service role).
--    Habilitar RLS SEM policies = bloqueia totalmente o acesso via chave anon,
--    então os códigos de cupom NUNCA ficam expostos no frontend.
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- EXEMPLOS (descomente/edite o que quiser criar)
-- ─────────────────────────────────────────────────────────
-- Lançamento: 10% off pros primeiros 20 alunos
-- INSERT INTO public.cupons (codigo, tipo, valor, max_usos)
-- VALUES ('CALOURO10', 'percent', 10, 20);

-- "Preço antigo" por 48h (some daqui 2 dias): R$5 de desconto fixo
-- INSERT INTO public.cupons (codigo, tipo, valor, expira_em)
-- VALUES ('PRECOANTIGO', 'fixo', 5, NOW() + INTERVAL '48 hours');

-- Desligar um cupom a qualquer momento:
-- UPDATE public.cupons SET ativo = FALSE WHERE codigo = 'CALOURO10';
