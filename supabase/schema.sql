-- ============================================================
-- SCHEMA - resumos-med
-- Cole este SQL no Supabase SQL Editor e execute
-- ============================================================

-- Tabela de perfis (complementa auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL,
  approved BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de resumos
CREATE TABLE IF NOT EXISTS resumos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  semester TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  html_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de permissões (quem pode ver o quê)
CREATE TABLE IF NOT EXISTS resumo_permissions (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  resumo_id UUID REFERENCES resumos(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, resumo_id)
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumo_permissions ENABLE ROW LEVEL SECURITY;

-- Profiles: usuário lê o próprio perfil
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Resumos: usuário só lê resumos que tem permissão
CREATE POLICY "users_read_permitted_resumos" ON resumos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM resumo_permissions
      WHERE resumo_permissions.resumo_id = resumos.id
        AND resumo_permissions.user_id = auth.uid()
    )
  );

-- Permissões: usuário só lê as próprias permissões
CREATE POLICY "users_read_own_permissions" ON resumo_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: cria profile automaticamente ao registrar
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABELAS DE VENDAS (Mercado Pago)
-- ============================================================

-- Vendas concluídas
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  amount NUMERIC(10,2) NOT NULL,
  mp_payment_id TEXT,
  mp_status TEXT DEFAULT 'approved',   -- approved | pending | rejected
  status TEXT DEFAULT 'approved',      -- approved | refunded
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tentativas de checkout que não finalizaram
CREATE TABLE IF NOT EXISTS checkout_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  name TEXT,
  preference_id TEXT,
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_attempts ENABLE ROW LEVEL SECURITY;

-- Somente admins (via service role) leem/escrevem — nenhuma policy pública

-- ============================================================
-- Tornar você admin: substitua o email abaixo pelo seu
-- Execute DEPOIS de criar sua conta no site
-- ============================================================
-- UPDATE profiles SET is_admin = TRUE, approved = TRUE
-- WHERE email = 'seu-email@exemplo.com';
