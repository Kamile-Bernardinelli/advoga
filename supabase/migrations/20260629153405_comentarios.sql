-- =============================================================================
-- Advoga — Comentários (explicações jurídicas das questões)
-- Migration: 20260629153405_comentarios.sql
-- Author: Dara (@data-engineer) · 2026-06-29
-- Depends on: 20260621120000 (questoes/respostas/sessoes), 120002 (RLS regime),
--             120003 (questoes_prova / corrigir_sessao / security_invoker convention)
-- =============================================================================
-- PURPOSE
--   Camada de ARMAZENAMENTO + ACESSO das explicações por questão ("comentários"):
--   por que o gabarito está certo + por que as demais alternativas estão erradas,
--   com fundamento legal. O CONTEÚDO em si é gerado depois, por um workflow
--   jurídico separado, que faz INSERT em public.comentarios (questao_id, comentario,
--   fonte, gerado_por). Esta migration NÃO popula nada.
--
-- DECISÃO DE MODELAGEM — TABELA, não coluna (1:1 com questoes)
--   Escolhida tabela `comentarios` (FK questao_id UNIQUE) em vez de uma coluna
--   `questoes.comentario`. Justificativa:
--     1. SEGURANÇA (decisiva): a coluna na `questoes` herdaria os MESMOS GRANTs da
--        tabela (authenticated tem SELECT em questoes USING true). Isolar o comentário
--        numa tabela própria dá uma SUPERFÍCIE DE GRANT independente — futuro REVOKE de
--        leitura durante prova ativa pode ser aplicado a `comentarios` sem mexer no resto
--        de `questoes`. Mantém o comentário fora de qualquer SELECT * acidental sobre questoes.
--     2. A `questoes_prova` (fronteira de segurança, §D-1) é `SELECT ... FROM questoes`.
--        Comentário em tabela separada => ESTRUTURALMENTE impossível vazar pela view de prova.
--     3. EXTENSIBILIDADE: metadados de geração (fonte, gerado_por, timestamps) vivem
--        junto ao texto sem inchar a linha quente de `questoes` (lida em todo fluxo de prova).
--     4. ESPARSO: comentários chegam aos poucos (geração assíncrona). Tabela 1:1 evita
--        coluna majoritariamente NULL e UPDATE da linha-mãe a cada geração.
--
-- SEGURANÇA — tratado EXATAMENTE como `gabarito` (fronteira-núcleo do projeto)
--   O comentário REVELA a resposta correta. Logo, mesmo regime de `questoes`/`gabarito`:
--     - Tabela de CONTEÚDO: RLS ON + FORCE; SELECT só para `authenticated` (USING true);
--       SEM policy de escrita => INSERT/UPDATE/DELETE negados a anon/authenticated;
--       escrita só via service_role (workflow jurídico/ingestão bypassa RLS).
--       Isso espelha `questoes_read_authenticated` 1:1.
--     - NUNCA aparece em `questoes_prova` (tabela separada; a view nem a referencia).
--     - É lido DEPOIS de responder, no fluxo /resultado (RSC anon key + RLS) — exatamente
--       como o /resultado já lê `questoes.gabarito` hoje. A página /resultado redireciona
--       de volta p/ a prova se `sessoes.fim IS NULL`, então só renderiza pós-finalize.
--   HARDENING FUTURO (simétrico ao do gabarito, hoje DEFERIDO p/ single-user Kamile):
--     "Avaliação Drop 2+: REVOKE SELECT (gabarito) FROM authenticated durante sessão ativa".
--     A mesma medida deve cobrir `comentarios` quando/se for aplicada — manter simétrico.
--
-- IDEMPOTÊNCIA
--   CREATE TABLE IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS -> CREATE,
--   CREATE OR REPLACE VIEW. Seguro re-rodar (aplicado via `psql -f`, padrão da casa).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TABELA comentarios — 1:1 com questoes (UNIQUE questao_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comentarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 1:1 com a questão. UNIQUE => no máximo um comentário por questão.
  -- ON DELETE CASCADE: comentário acompanha a questão (consistente com questao_tags).
  questao_id  uuid NOT NULL REFERENCES public.questoes(id) ON DELETE CASCADE,
  -- explicação jurídica completa (gabarito certo + por que as demais erram + fundamento).
  -- NOT NULL: linha só existe quando há conteúdo (geração faz INSERT quando pronto).
  comentario  text NOT NULL CHECK (length(btrim(comentario)) > 0),
  -- fundamento legal citado (ex.: 'CF/88 art. 5º, LIV; CPC art. 300'). Opcional.
  fonte       text,
  -- procedência do comentário. text ABERTO por decisão de design (não enum):
  -- pode registrar o gerador específico ('llm', 'llm:deepseek', 'humano', 'curadoria').
  gerado_por  text NOT NULL DEFAULT 'llm',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comentarios_questao_uniq UNIQUE (questao_id)
);

COMMENT ON TABLE  public.comentarios IS
  'Explicação jurídica por questão (1:1 com questoes). REVELA a resposta -> mesmo regime de segurança do gabarito: '
  'RLS leitura authenticated, escrita só service_role; NUNCA em questoes_prova; lido só pós-resposta (/resultado). '
  'Conteúdo gerado por workflow jurídico externo via INSERT (questao_id, comentario, fonte, gerado_por).';
COMMENT ON COLUMN public.comentarios.questao_id IS 'FK -> questoes(id), UNIQUE (1:1). ON DELETE CASCADE.';
COMMENT ON COLUMN public.comentarios.comentario IS 'Texto da explicação (gabarito certo + por que as demais erram + fundamento legal). NOT NULL/não-vazio.';
COMMENT ON COLUMN public.comentarios.fonte      IS 'Fundamento legal citado (artigos/súmulas). Opcional/NULL.';
COMMENT ON COLUMN public.comentarios.gerado_por IS 'Procedência (text aberto): llm | humano | curadoria | <modelo>. Default llm.';

-- -----------------------------------------------------------------------------
-- 2. updated_at trigger (baseline: toda tabela mutável)
--    Reusa public.set_updated_at() (search_path travado, definida em 120000).
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.comentarios;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.comentarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. RLS — espelha EXATAMENTE o regime de `questoes` (conteúdo compartilhado)
--    RLS ON + FORCE; única policy = SELECT p/ authenticated (USING true).
--    Sem policy de escrita => anon/authenticated não escrevem; service_role bypassa.
-- -----------------------------------------------------------------------------
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comentarios_read_authenticated ON public.comentarios;
CREATE POLICY comentarios_read_authenticated ON public.comentarios
  FOR SELECT
  TO authenticated
  USING (true);

-- Belt-and-suspenders: garante o GRANT de leitura mesmo que default privileges
-- do Supabase não disparem neste contexto. Escrita continua barrada por RLS (sem policy).
GRANT SELECT ON public.comentarios TO authenticated;

-- =============================================================================
-- 4. VIEW de conveniência v_resultado_comentario (security_invoker=on)
--    Superfície de LEITURA pós-resposta do fluxo /resultado: junta o comentário
--    à QUESTÃO RESPONDIDA pela usuária em SESSÕES FINALIZADAS.
--
--    SEGURANÇA (por que NÃO é alcançável antes de responder):
--      - security_invoker=on => roda com privilégios/RLS de quem consulta.
--        RLS de respostas (auth.uid()=user_id) + sessoes (auth.uid()=user_id) limita
--        às próprias respostas da usuária.
--      - JOIN sessoes ... AND s.fim IS NOT NULL => só sessões FINALIZADAS. Durante a
--        prova ativa, `respostas` já existe (correta=NULL) mas `sessoes.fim IS NULL`,
--        então o JOIN exclui tudo de sessão ativa. Mesmo se mal-usada, retorna 0 linhas
--        em prova ativa => não vira fonte de questão pré-resposta.
--      - NÃO é a `questoes_prova`. O test runner consulta apenas `questoes_prova`
--        (hardcoded em colunas-prova.ts / page.tsx) — nunca esta view.
--      - LEFT JOIN comentarios => questão sem comentário gerado ainda aparece
--        (comentario NULL), permitindo o front exibir "explicação em breve".
-- =============================================================================
CREATE OR REPLACE VIEW public.v_resultado_comentario
WITH (security_invoker=on)
AS
SELECT
  r.id              AS resposta_id,
  r.sessao_id,
  r.user_id,
  r.questao_id,
  q.num_prova,
  r.resposta_dada,
  r.correta,
  q.gabarito,                 -- pós-resposta (gabarito já liberado); NUNCA em questoes_prova
  q.enunciado,
  q.alt_a,
  q.alt_b,
  q.alt_c,
  q.alt_d,
  q.validade_status,
  c.comentario,
  c.fonte,
  c.gerado_por
FROM public.respostas r
JOIN public.sessoes   s ON s.id = r.sessao_id AND s.fim IS NOT NULL   -- só FINALIZADAS
JOIN public.questoes  q ON q.id = r.questao_id
LEFT JOIN public.comentarios c ON c.questao_id = r.questao_id;        -- comentário pode ainda não existir

COMMENT ON VIEW public.v_resultado_comentario IS
  'Superfície de leitura PÓS-RESPOSTA do /resultado: comentário + questão respondida em sessões FINALIZADAS '
  '(s.fim NOT NULL). security_invoker=on => RLS de respostas/sessoes limita às próprias linhas da usuária. '
  'NÃO é questoes_prova e retorna 0 linhas em sessão ativa => nunca é fonte de questão pré-resposta. '
  'LEFT JOIN comentarios: questão sem comentário ainda aparece (comentario NULL).';

COMMIT;

-- =============================================================================
-- SUMÁRIO DE MUDANÇAS (somente ADIÇÃO — nada existente é alterado/derrubado)
--   + CREATE TABLE public.comentarios (1:1 questoes, UNIQUE questao_id)
--   + TRIGGER trg_set_updated_at em comentarios
--   + RLS ON+FORCE + POLICY comentarios_read_authenticated (SELECT authenticated)
--   + GRANT SELECT ON comentarios TO authenticated (insurance; escrita barrada por RLS)
--   + CREATE VIEW v_resultado_comentario (security_invoker=on, pós-resposta)
--
--   INALTERADO: questoes, questoes_prova, gabarito, corrigir_sessao, todas as views diag/*.
--   questoes_prova segue SEM comentário (tabela separada; a view não a referencia).
--
-- ONDE O GERADOR JURÍDICO ESCREVE (próximo workflow):
--   INSERT INTO public.comentarios (questao_id, comentario, fonte, gerado_por)
--   VALUES ($1, $2, $3, 'llm')
--   ON CONFLICT (questao_id) DO UPDATE
--     SET comentario = EXCLUDED.comentario,
--         fonte      = EXCLUDED.fonte,
--         gerado_por = EXCLUDED.gerado_por;
--   -- usar service_role (RLS não tem policy de escrita p/ authenticated).
--
-- ROLLBACK (se necessário):
--   BEGIN;
--     DROP VIEW  IF EXISTS public.v_resultado_comentario;
--     DROP TABLE IF EXISTS public.comentarios;  -- CASCADE não necessário (nada depende)
--   COMMIT;
-- =============================================================================
