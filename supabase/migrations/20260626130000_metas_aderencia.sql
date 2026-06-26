-- =============================================================================
-- Advoga — Cockpit v2: LOOP DE ADERÊNCIA (metas + saldo) — SCHEMA ADITIVO
-- Migration: 20260626130000_metas_aderencia.sql
-- Author: Dara (@data-engineer) · Design: Aria (@architect)
-- Depends on: 20260621120000..120003 (tabelas/RLS/diag), 20260626120000 (estudo_sessoes)
-- =============================================================================
-- PURPOSE
--   metas_estudo   — config singleton: meta base diária, meta mensal, dias de estudo, timezone
--   metas_diarias  — override de meta por dia específico (0 = folga)
--   meta_do_dia()  — função canônica: override -> base(se dia de estudo) -> 0
--   v_saldo_diario — real × meta por dia + acumulado (semana/mês/total)  [timezone-aware]
--   v_saldo_mensal — real × meta mensal por mês (o "contrato")
--
-- ADITIVO: nenhum ALTER/DROP em objeto existente. Seguro re-rodar (idempotente).
-- =============================================================================

BEGIN;

-- set_updated_at() e pgcrypto já existem (init_schema) — reutilizados.

-- -----------------------------------------------------------------------------
-- 1. METAS_ESTUDO — config singleton por usuária
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metas_estudo (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_base_diaria_min integer NOT NULL DEFAULT 180
                         CHECK (meta_base_diaria_min >= 0 AND meta_base_diaria_min <= 1440),
  meta_mensal_min      integer
                         CHECK (meta_mensal_min IS NULL
                                OR (meta_mensal_min >= 0 AND meta_mensal_min <= 44640)), -- 31*1440
  dias_estudo          smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  timezone             text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_estudo_user_uniq UNIQUE (user_id),
  CONSTRAINT metas_estudo_dias_validos
    CHECK (dias_estudo <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
);
COMMENT ON TABLE public.metas_estudo IS
  'Config singleton de metas de tempo da usuária. dias_estudo (0=Dom..6=Sab, igual JS getDay) e '
  'timezone alimentam TANTO o saldo QUANTO o orçamento diário do gerador de cronograma. RLS auth.uid()=user_id.';

-- -----------------------------------------------------------------------------
-- 2. METAS_DIARIAS — override de meta por dia (0 = folga). Vence a base.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metas_diarias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data         date NOT NULL,
  minutos_meta integer NOT NULL CHECK (minutos_meta >= 0 AND minutos_meta <= 1440),
  nota         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_diarias_user_data_uniq UNIQUE (user_id, data)
);
COMMENT ON TABLE public.metas_diarias IS
  'Override de meta diária por data (substitui a base; 0 = folga). Base da compensação. RLS auth.uid()=user_id.';

-- -----------------------------------------------------------------------------
-- 3. ÍNDICES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_metas_estudo_user  ON public.metas_estudo (user_id);
CREATE INDEX IF NOT EXISTS idx_metas_diarias_user_data ON public.metas_diarias (user_id, data);

-- -----------------------------------------------------------------------------
-- 4. TRIGGERS updated_at (reusa public.set_updated_at())
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; tbls text[] := ARRAY['metas_estudo','metas_diarias'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5. RLS single-user — espelha 20260626120000 (user_id direto → sem trigger de sync)
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; tbls text[] := ARRAY['metas_estudo','metas_diarias'];
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
-- 6. meta_do_dia() — SINGLE SOURCE OF TRUTH: override -> base(se dia de estudo) -> 0
--    EXTRACT(DOW) = 0..6 (Dom..Sab), mesma convenção do JS Date.getDay().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.meta_do_dia(p_user_id uuid, p_data date)
RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(
    (SELECT md.minutos_meta
       FROM public.metas_diarias md
       WHERE md.user_id = p_user_id AND md.data = p_data),
    (SELECT CASE
              WHEN EXTRACT(DOW FROM p_data)::smallint = ANY(me.dias_estudo)
              THEN me.meta_base_diaria_min ELSE 0 END
       FROM public.metas_estudo me
       WHERE me.user_id = p_user_id),
    0
  );
$$;
COMMENT ON FUNCTION public.meta_do_dia(uuid, date) IS
  'Meta de minutos de um dia: override (metas_diarias) -> base (metas_estudo, se dia de estudo) -> 0. '
  'Single source of truth — o gerador de cronograma usa a MESMA fórmula em TS.';

-- -----------------------------------------------------------------------------
-- 7. VIEW v_saldo_diario — real × meta por dia + acumulado (timezone-aware)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_saldo_diario
WITH (security_invoker=on) AS
WITH cfg AS (
  SELECT user_id, timezone FROM public.metas_estudo
),
bounds AS (
  SELECT c.user_id, c.timezone,
         COALESCE(MIN((es.ts AT TIME ZONE c.timezone)::date),
                  (now() AT TIME ZONE c.timezone)::date)      AS dia_ini,
         (now() AT TIME ZONE c.timezone)::date                AS dia_fim
  FROM cfg c
  LEFT JOIN public.estudo_sessoes es ON es.user_id = c.user_id
  GROUP BY c.user_id, c.timezone
),
dias AS (
  SELECT b.user_id, gs::date AS dia,
         public.meta_do_dia(b.user_id, gs::date) AS meta_min
  FROM bounds b
  CROSS JOIN LATERAL generate_series(b.dia_ini, b.dia_fim, interval '1 day') gs
),
real AS (
  SELECT es.user_id, (es.ts AT TIME ZONE c.timezone)::date AS dia,
         SUM(es.duracao_min)::int AS real_min, COUNT(*)::int AS n_sessoes
  FROM public.estudo_sessoes es
  JOIN cfg c ON c.user_id = es.user_id
  GROUP BY es.user_id, (es.ts AT TIME ZONE c.timezone)::date
),
base AS (
  SELECT d.user_id, d.dia, d.meta_min,
         COALESCE(r.real_min, 0)  AS real_min,
         COALESCE(r.n_sessoes, 0) AS n_sessoes
  FROM dias d
  LEFT JOIN real r ON r.user_id = d.user_id AND r.dia = d.dia
)
SELECT
  user_id, dia, meta_min, real_min, n_sessoes,
  (real_min - meta_min)                                                  AS saldo_dia,
  SUM(real_min - meta_min) OVER (
    PARTITION BY user_id, date_trunc('week',  dia) ORDER BY dia)::int     AS saldo_acum_semana,
  SUM(real_min - meta_min) OVER (
    PARTITION BY user_id, date_trunc('month', dia) ORDER BY dia)::int     AS saldo_acum_mes,
  SUM(real_min - meta_min) OVER (
    PARTITION BY user_id ORDER BY dia)::int                               AS saldo_acum_total
FROM base;
COMMENT ON VIEW public.v_saldo_diario IS
  'Saldo de tempo por dia (real × meta_do_dia) + acumulado semana/mes/total. Timezone-aware '
  '(date(ts AT TIME ZONE timezone)). Ancorado na 1a sessao (sem deficit fantasma). security_invoker=on.';

-- -----------------------------------------------------------------------------
-- 8. VIEW v_saldo_mensal — real × meta mensal (o "contrato")
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_saldo_mensal
WITH (security_invoker=on) AS
WITH cfg AS (
  SELECT user_id, timezone, meta_mensal_min FROM public.metas_estudo
),
mensal AS (
  SELECT es.user_id,
         date_trunc('month', (es.ts AT TIME ZONE c.timezone))::date AS mes,
         SUM(es.duracao_min)::int AS real_min, COUNT(*)::int AS n_sessoes
  FROM public.estudo_sessoes es
  JOIN cfg c ON c.user_id = es.user_id
  GROUP BY es.user_id, date_trunc('month', (es.ts AT TIME ZONE c.timezone))
)
SELECT
  m.user_id, m.mes, c.meta_mensal_min, m.real_min, m.n_sessoes,
  (m.real_min - COALESCE(c.meta_mensal_min, 0)) AS saldo_mes,
  CASE WHEN c.meta_mensal_min IS NULL OR c.meta_mensal_min = 0 THEN NULL
       ELSE round(100.0 * m.real_min / c.meta_mensal_min, 1) END AS pct_meta
FROM mensal m
JOIN cfg c ON c.user_id = m.user_id;
COMMENT ON VIEW public.v_saldo_mensal IS
  'Saldo mensal (real × meta_mensal_min). O contrato. So aparece mes com sessoes; mes corrente vazio '
  'a app trata como 0/meta. Ritmo necessario/dias restantes ficam no app (saldo.ts). security_invoker=on.';

COMMIT;

-- =============================================================================
-- PÓS-MIGRATION (processo, não DDL):
--   supabase gen types typescript --local > src/lib/types/db.types.ts
--   (regenera tipos das 2 tabelas + 2 views; NÃO editar db.types.ts à mão)
-- =============================================================================
