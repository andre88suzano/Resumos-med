-- ============================================================
-- BLINDAGEM RLS — resumos-med
-- Rode no Supabase: SQL Editor → cole tudo → Run.
--
-- O QUE FAZ:
--   1. Cria função is_admin() (checa profiles.is_admin do usuário logado).
--   2. Tira a coluna `content` de resumos/questoes do alcance de anon e
--      authenticated → o conteúdo só sai pelas Cloudflare Functions
--      (/api/resumo-content, /api/questao-content, /api/feedbacks), que
--      conferem o acesso e usam a service key.
--   3. RLS: leitura de METADADOS liberada a logados; ESCRITA só admin.
--   4. user_access / user_questoes_access: aluno lê só o próprio; escrita
--      só admin (o webhook de pagamento usa service key e ignora RLS).
--
-- PRÉ-REQUISITO: o novo código (functions + frontend) já deve estar no ar.
-- Depois de rodar, teste pelo site logado como aluno e como admin.
-- ============================================================

-- 1. Função utilitária de admin -----------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- 2. Remove TODAS as policies atuais dessas tabelas ---------
--    (recriadas abaixo de forma conhecida e segura)
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('resumos','questoes','user_access','user_questoes_access')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 3. Garante RLS ligado -------------------------------------
alter table public.resumos               enable row level security;
alter table public.questoes              enable row level security;
alter table public.user_access           enable row level security;
alter table public.user_questoes_access  enable row level security;

-- 4. Esconde a coluna `content` de anon e authenticated -----
--    IMPORTANTE: REVOKE SELECT(content) é no-op quando existe GRANT SELECT
--    de tabela inteira. O correto é revogar o SELECT da tabela e conceder
--    SELECT só nas colunas de metadados. (service_role mantém acesso total.)
revoke select on public.resumos  from anon, authenticated;
grant  select (id, title, materia, semestre, parcial, description, created_at)
  on public.resumos to authenticated;

revoke select on public.questoes from anon, authenticated;
grant  select (id, title, materia, semestre, parcial, created_at)
  on public.questoes to authenticated;

-- 5. POLICIES -----------------------------------------------

-- resumos: logado lê metadados (a coluna content já está revogada);
--          escrita só admin.
create policy resumos_select_meta on public.resumos
  for select to authenticated using (true);
create policy resumos_admin_write on public.resumos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- questoes: idem.
create policy questoes_select_meta on public.questoes
  for select to authenticated using (true);
create policy questoes_admin_write on public.questoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_access: aluno lê só o próprio; escrita só admin
--              (webhook de pagamento usa service key → ignora RLS).
create policy ua_select_own on public.user_access
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy ua_admin_write on public.user_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_questoes_access: idem.
create policy uqa_select_own on public.user_questoes_access
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy uqa_admin_write on public.user_questoes_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- VERIFICAÇÃO (opcional) — rode logado como ALUNO no site e confira:
--   • abrir um resumo COMPRADO → funciona
--   • abrir um NÃO comprado    → "Sem acesso"
--   • aba Feedbacks            → imagens aparecem
--   • banco de questões        → abre só os liberados
-- E como ADMIN:
--   • criar / editar / excluir resumo e questão → funciona
--   • liberar / revogar acesso de aluno         → funciona
-- ============================================================
