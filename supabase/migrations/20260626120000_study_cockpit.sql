-- =============================================================================
-- Advoga — Cockpit de Estudo (Drop 1.5) — SCHEMA ADITIVO
-- Migration: 20260626120000_study_cockpit.sql
-- Author: Dara (@data-engineer) · Design: Aria (@architect)
-- Depends on: 20260621120000 (tabelas/enum/trigger), 120001 (diag views + gate),
--             120002 (RLS), 120003 (diag_por_no com d-8/security_invoker)
-- =============================================================================
-- PURPOSE
--   Pilar NOVO de estudo (complementa o pilar de questões, intocado):
--     materiais        — catálogo de materiais da usuária
--     estudo_sessoes   — SENSOR: log de tempo de estudo (1 linha = 1 evento)
--     cronograma_blocos— ROTEIRO: blocos de estudo no calendário até a prova
--     v_tempo_por_no   — tempo agregado por nó de conteúdo (espelha diag_por_no)
--     v_esforco_resultado — CRUZAMENTO tempo × acerto, com GATE DUPLO anti-chute
--
-- ADITIVO: nenhum ALTER/DROP em objeto existente. Seguro re-rodar (idempotente).
-- =============================================================================

BEGIN;

-- pgcrypto já existe (init_schema). set_updated_at() já existe — reutilizado.

-- -----------------------------------------------------------------------------
-- 1. ENUMS (DO-block guard — padrão da casa; CREATE TYPE não aceita IF NOT EXISTS)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.material_tipo AS ENUM
    ('livro','pdf','video','curso','lei','resumo','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_estudo AS ENUM
    ('leitura','video','resumo','revisao','questoes','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cronograma_tipo AS ENUM ('conteudo','questoes','revisao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bloco_status AS ENUM ('pendente','em_andamento','feito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bloco_origem AS ENUM ('gerado','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. MATERIAIS — catálogo de materiais de estudo da usuária
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materiais (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  tipo        public.material_tipo NOT NULL DEFAULT 'outro',
  referencia  text,                       -- url OU referência livre (ed., capítulo…)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materiais_user_nome_uniq UNIQUE (user_id, nome)
);
COMMENT ON TABLE public.materiais IS
  'Catálogo de materiais de estudo da usuária (livro/pdf/video/curso/lei/resumo). RLS auth.uid()=user_id.';

-- -----------------------------------------------------------------------------
-- 3. ESTUDO_SESSOES — O SENSOR: log de tempo (1 linha = 1 evento de estudo)
--   duracao_min é coluna REAL (não GENERATED): entrada manual digita os minutos
--   sem inicio/fim. inicio/fim são metadados opcionais (timer da Fatia 2).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estudo_sessoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  materia_id      uuid NOT NULL REFERENCES public.materias(id)      ON DELETE RESTRICT,
  subtema_id      uuid          REFERENCES public.subtemas(id)      ON DELETE SET NULL,
  micro_topico_id uuid          REFERENCES public.micro_topicos(id) ON DELETE SET NULL,
  material_id     uuid          REFERENCES public.materiais(id)     ON DELETE SET NULL,
  local           text,
  tipo_estudo     public.tipo_estudo NOT NULL DEFAULT 'leitura',
  inicio          timestamptz,                  -- opcional (timer)
  fim             timestamptz,                  -- opcional (timer)
  duracao_min     integer NOT NULL CHECK (duracao_min > 0),  -- PAYLOAD canônico
  anotacao        text,
  ts              timestamptz NOT NULL DEFAULT now(),         -- quando o evento ocorreu
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estudo_micro_requer_subtema
    CHECK (micro_topico_id IS NULL OR subtema_id IS NOT NULL),
  CONSTRAINT estudo_fim_apos_inicio
    CHECK (fim IS NULL OR inicio IS NULL OR fim >= inicio)
);
COMMENT ON TABLE public.estudo_sessoes IS
  'SENSOR de tempo de estudo (1 linha = 1 evento). duracao_min é canônico (entrada manual). '
  'inicio/fim opcionais (timer Fatia 2). Base do cruzamento tempo×resultado (v_esforco_resultado).';
COMMENT ON COLUMN public.estudo_sessoes.duracao_min IS
  'Minutos estudados. Coluna real (não GENERATED) p/ permitir entrada manual sem inicio/fim.';

-- -----------------------------------------------------------------------------
-- 4. CRONOGRAMA_BLOCOS — O ROTEIRO: blocos de estudo no calendário
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cronograma_blocos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  data_alvo    date NOT NULL,
  materia_id   uuid NOT NULL REFERENCES public.materias(id)  ON DELETE CASCADE,
  subtema_id   uuid          REFERENCES public.subtemas(id)  ON DELETE SET NULL,
  tipo         public.cronograma_tipo NOT NULL DEFAULT 'conteudo',
  minutos_alvo integer NOT NULL CHECK (minutos_alvo > 0),
  status       public.bloco_status NOT NULL DEFAULT 'pendente',
  ordem        smallint NOT NULL DEFAULT 0,         -- ordem dentro do dia
  origem       public.bloco_origem NOT NULL DEFAULT 'gerado',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.cronograma_blocos IS
  'ROTEIRO de estudo: blocos (conteudo|questoes|revisao) no calendário até a prova. '
  'origem=gerado (planner) | manual (Kamile). Re-geração preserva feito/manual.';

-- -----------------------------------------------------------------------------
-- 5. ÍNDICES (access patterns: agregação de tempo + leitura do cronograma)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_estudo_user        ON public.estudo_sessoes (user_id);
CREATE INDEX IF NOT EXISTS idx_estudo_user_ts      ON public.estudo_sessoes (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_estudo_materia      ON public.estudo_sessoes (materia_id);
CREATE INDEX IF NOT EXISTS idx_estudo_subtema      ON public.estudo_sessoes (subtema_id);
CREATE INDEX IF NOT EXISTS idx_estudo_material     ON public.estudo_sessoes (material_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_user_data ON public.cronograma_blocos (user_id, data_alvo);
CREATE INDEX IF NOT EXISTS idx_cronograma_user_status ON public.cronograma_blocos (user_id, status);
CREATE INDEX IF NOT EXISTS idx_materiais_user      ON public.materiais (user_id);

-- -----------------------------------------------------------------------------
-- 6. TRIGGERS updated_at (reusa public.set_updated_at())
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; tbls text[] := ARRAY['materiais','estudo_sessoes','cronograma_blocos'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 7. RLS single-user — espelha 20260621120002 (sessoes/respostas/plano_diario)
--    user_id direto em todas → sem trigger de sync (diferente de respostas).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; tbls text[] := ARRAY['materiais','estudo_sessoes','cronograma_blocos'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE  ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                      USING (auth.uid() = user_id);', t||'_select_own', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
                      WITH CHECK (auth.uid() = user_id);', t||'_insert_own', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
                      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);',
                   t||'_update_own', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_delete_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
                      USING (auth.uid() = user_id);', t||'_delete_own', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 8. GATE DE TEMPO — single source of truth do limiar anti-chute de esforço
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esforco_gate_tempo_min()
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT 60 $$;   -- minutos mínimos p/ declarar padrão de esforço (calibrável)
COMMENT ON FUNCTION public.esforco_gate_tempo_min() IS
  'Limiar anti-chute de ESFORÇO: minutos mínimos p/ declarar padrão tempo×resultado. Default 60.';

-- -----------------------------------------------------------------------------
-- 9. VIEW v_tempo_por_no — tempo agregado por nó de conteúdo (espelha diag_por_no)
--    Mesma chave (user_id, eixo, no_id) → joinável com diag_por_no.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_tempo_por_no
WITH (security_invoker=on) AS
WITH materia AS (
  SELECT es.user_id, 'materia'::text AS eixo, es.materia_id::text AS no_id,
         m.nome AS no_nome, sum(es.duracao_min) AS total_min,
         count(*) AS n_sessoes, max(es.ts) AS ultimo_ts
  FROM public.estudo_sessoes es
  JOIN public.materias m ON m.id = es.materia_id
  GROUP BY es.user_id, es.materia_id, m.nome
),
subtema AS (
  SELECT es.user_id, 'subtema'::text AS eixo, es.subtema_id::text AS no_id,
         s.nome AS no_nome, sum(es.duracao_min) AS total_min,
         count(*) AS n_sessoes, max(es.ts) AS ultimo_ts
  FROM public.estudo_sessoes es
  JOIN public.subtemas s ON s.id = es.subtema_id
  WHERE es.subtema_id IS NOT NULL
  GROUP BY es.user_id, es.subtema_id, s.nome
),
micro AS (
  SELECT es.user_id, 'micro'::text AS eixo, es.micro_topico_id::text AS no_id,
         mt.nome AS no_nome, sum(es.duracao_min) AS total_min,
         count(*) AS n_sessoes, max(es.ts) AS ultimo_ts
  FROM public.estudo_sessoes es
  JOIN public.micro_topicos mt ON mt.id = es.micro_topico_id
  WHERE es.micro_topico_id IS NOT NULL
  GROUP BY es.user_id, es.micro_topico_id, mt.nome
)
SELECT * FROM materia
UNION ALL SELECT * FROM subtema
UNION ALL SELECT * FROM micro;

COMMENT ON VIEW public.v_tempo_por_no IS
  'Tempo de estudo agregado por nó de conteúdo (materia|subtema|micro). '
  'Mesma chave (user_id,eixo,no_id) de diag_por_no → cruzável. security_invoker=on.';

-- -----------------------------------------------------------------------------
-- 10. VIEW v_esforco_resultado — CRUZAMENTO tempo × acerto (gate DUPLO)
--    FULL OUTER JOIN p/ capturar quadrantes com um lado nulo
--    ("estudou sem fazer questão" / "vai mal e nunca estudou").
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_esforco_resultado
WITH (security_invoker=on) AS
SELECT
  COALESCE(t.user_id, d.user_id)                      AS user_id,
  COALESCE(t.eixo, d.eixo)                            AS eixo,
  COALESCE(t.no_id, d.no_id)                          AS no_id,
  COALESCE(t.no_nome, d.no_nome)                      AS no_nome,
  COALESCE(t.total_min, 0)                            AS total_min,
  COALESCE(t.n_sessoes, 0)                            AS n_sessoes,
  COALESCE(d.n_feitas, 0)                             AS n_feitas,
  COALESCE(d.n_acertos, 0)                            AS n_acertos,
  d.taxa                                              AS taxa,          -- NULL se sem questões
  (COALESCE(t.total_min,0) >= public.esforco_gate_tempo_min()) AS tempo_ok,
  COALESCE(d.amostra_suficiente, false)              AS questoes_ok,    -- gate ≥8 reusado
  -- padrão confiável: AMBOS os lados presentes E ambos os gates passados
  (t.user_id IS NOT NULL AND d.user_id IS NOT NULL
     AND COALESCE(t.total_min,0) >= public.esforco_gate_tempo_min()
     AND COALESCE(d.amostra_suficiente,false))        AS padrao_confiavel,
  now()                                               AS atualizado_em
FROM public.v_tempo_por_no t
FULL OUTER JOIN public.diag_por_no d
  ON  d.user_id = t.user_id
  AND d.eixo    = t.eixo
  AND d.no_id   = t.no_id;

COMMENT ON VIEW public.v_esforco_resultado IS
  'CRUZAMENTO esforço×resultado por nó. Gate DUPLO: tempo_ok (>=60min) E questoes_ok (>=8). '
  'padrao_confiavel só quando ambos lados presentes + ambos gates. FULL OUTER p/ ver quadrantes '
  'com lado nulo. Rótulo do quadrante fica no app (esforco.ts) — fato vs recomendação (§4).';

COMMIT;

-- =============================================================================
-- PÓS-MIGRATION (processo, não DDL):
--   supabase gen types typescript --local > src/lib/types/db.types.ts
--   (regenera tipos das 3 tabelas + 2 views; NÃO editar db.types.ts à mão)
-- =============================================================================
