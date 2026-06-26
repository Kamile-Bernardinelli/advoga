-- =============================================================================
-- Advoga — RLS Single-User (Supabase Auth)
-- Migration: 20260621120002_rls_single_user.sql
-- Author: Dara (@data-engineer) · 2026-06-21
-- Depends on: 20260621120000_init_schema.sql
-- =============================================================================
-- ESTRATÉGIA DE SEGURANÇA (defense-in-depth)
--
--   Duas classes de tabela, dois regimes de RLS:
--
--   (1) DADOS DA USUÁRIA  — sessoes, respostas, plano_diario
--       RLS ON. Policies `auth.uid() = user_id`.
--       Single-user HOJE (só a Kamile), mas o predicado já é o correto p/
--       multi-user (D-01). Virar multi-user = ZERO mudança aqui.
--
--   (2) CONTEÚDO COMPARTILHADO — materias, subtemas, micro_topicos, dimensoes,
--       dimensao_valores, exames, questoes, questao_tags
--       RLS ON. LEITURA: qualquer usuário autenticado (SELECT to authenticated).
--       ESCRITA: NEGADA por padrão (nenhuma policy de write p/ authenticated).
--       Quem escreve conteúdo (ingestão, tagging em lote/ultracode, curadoria)
--       usa a SERVICE_ROLE key, que BYPASSA RLS por construção do Supabase.
--       => Não criamos policy de write: a ausência de policy = deny p/ clientes
--          normais; service_role passa por cima. Isso é o padrão Supabase para
--          "tabela read-only para o app, gravável só pelo backend/admin".
--
--   POR QUE RLS ON mesmo em tabelas de leitura pública?
--       Supabase expõe TODA tabela em `public` via PostgREST. Sem RLS ON, a
--       tabela fica TOTALMENTE aberta (inclusive escrita) para a anon/auth key.
--       RLS ON + só policy de SELECT = leitura controlada, escrita fechada.
--       (Constituição Dara: "Security by default".)
--
--   ⚠️ Auth note (security_notes do agente): se não houver usuário logado,
--       auth.uid() retorna NULL e as policies de dados da usuária não casam
--       (nega tudo) — comportamento correto/seguro. O app deve autenticar a
--       Kamile (Supabase Auth) antes de ler/gravar dados dela.
--
-- IDEMPOTÊNCIA
--   ENABLE RLS é idempotente. Policies usam DROP POLICY IF EXISTS -> CREATE.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CONTEÚDO COMPARTILHADO — RLS ON + leitura autenticada, escrita só service_role
--   Estratégia: uma policy SELECT por tabela para `authenticated`.
--   Nenhuma policy de INSERT/UPDATE/DELETE => negado a anon/authenticated.
--   service_role bypassa RLS (escreve via backend/ingestão/ultracode).
-- =============================================================================
DO $$
DECLARE
  t text;
  conteudo text[] := ARRAY[
    'materias','subtemas','micro_topicos',
    'dimensoes','dimensao_valores',
    'exames','questoes','questao_tags'
  ];
BEGIN
  FOREACH t IN ARRAY conteudo LOOP
    -- 1.a habilita RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    -- 1.b (boa prática) força RLS inclusive para o owner da tabela
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);

    -- 1.c policy de LEITURA p/ autenticados (idempotente)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_read_authenticated', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR SELECT
        TO authenticated
        USING (true);
    $f$, t || '_read_authenticated', t);

    -- 1.d SEM policy de write => escrita negada p/ anon/authenticated.
    --      service_role bypassa RLS e cobre ingestão/tagging/curadoria.
  END LOOP;
END $$;

-- Comentário-âncora da estratégia de escrita de conteúdo:
COMMENT ON TABLE public.questoes IS
  'Questão (enunciado + 4 alternativas + gabarito). RLS: leitura authenticated; escrita só service_role (ingestão/ultracode). ~3.680 no destino.';

-- =============================================================================
-- 2. DADOS DA USUÁRIA — RLS ON + policies auth.uid() = user_id
--   Predicado idêntico para SELECT/INSERT/UPDATE/DELETE (dono total dos dados).
--   WITH CHECK garante que a usuária não insira/atualize linha de outro user_id.
-- =============================================================================

-- 2.1 SESSOES
ALTER TABLE public.sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessoes_select_own ON public.sessoes;
CREATE POLICY sessoes_select_own ON public.sessoes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sessoes_insert_own ON public.sessoes;
CREATE POLICY sessoes_insert_own ON public.sessoes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS sessoes_update_own ON public.sessoes;
CREATE POLICY sessoes_update_own ON public.sessoes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS sessoes_delete_own ON public.sessoes;
CREATE POLICY sessoes_delete_own ON public.sessoes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2.2 RESPOSTAS
--   user_id é desnormalizado de sessoes e mantido por trigger (ver init_schema).
--   RLS usa a coluna local -> sem subquery por linha (rápido) e seguro: a trigger
--   força user_id = dono da sessão, então não dá pra "forjar" via WITH CHECK.
ALTER TABLE public.respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS respostas_select_own ON public.respostas;
CREATE POLICY respostas_select_own ON public.respostas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS respostas_insert_own ON public.respostas;
CREATE POLICY respostas_insert_own ON public.respostas
  FOR INSERT TO authenticated
  -- defesa extra: a resposta tem que pertencer a uma sessão da própria usuária.
  -- (a trigger ainda sobrescreve user_id; este CHECK é cinto + suspensório.)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.sessoes s
      WHERE s.id = sessao_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS respostas_update_own ON public.respostas;
CREATE POLICY respostas_update_own ON public.respostas
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS respostas_delete_own ON public.respostas;
CREATE POLICY respostas_delete_own ON public.respostas
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2.3 PLANO_DIARIO
ALTER TABLE public.plano_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_diario FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plano_diario_select_own ON public.plano_diario;
CREATE POLICY plano_diario_select_own ON public.plano_diario
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS plano_diario_insert_own ON public.plano_diario;
CREATE POLICY plano_diario_insert_own ON public.plano_diario
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS plano_diario_update_own ON public.plano_diario;
CREATE POLICY plano_diario_update_own ON public.plano_diario
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS plano_diario_delete_own ON public.plano_diario;
CREATE POLICY plano_diario_delete_own ON public.plano_diario
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMIT;

-- =============================================================================
-- VALIDAÇÃO RLS (positivo/negativo) — rodar manualmente após `supabase start`.
--   (Não executado pela migration; guia de smoke-test para @qa / Dara.)
--
--   -- Como a Kamile (set local do JWT claim):
--   --   SELECT set_config('request.jwt.claims',
--   --     json_build_object('sub','<kamile-uuid>','role','authenticated')::text, true);
--   --   SET ROLE authenticated;
--   --   SELECT count(*) FROM public.respostas;          -- vê só as dela
--   --   INSERT INTO public.sessoes(user_id, tipo) VALUES (auth.uid(),'treino'); -- OK
--   --   INSERT INTO public.sessoes(user_id, tipo)
--   --     VALUES ('00000000-0000-0000-0000-000000000000','treino'); -- NEGADO (WITH CHECK)
--   --   INSERT INTO public.questoes(...);               -- NEGADO (sem policy write)
--   --   RESET ROLE;
--
--   -- Conteúdo legível por qualquer autenticado:
--   --   SET ROLE authenticated; SELECT count(*) FROM public.questoes;  -- OK (read)
--
--   -- service_role bypassa tudo (ingestão):
--   --   SET ROLE service_role; INSERT INTO public.questoes(...);       -- OK
-- =============================================================================
