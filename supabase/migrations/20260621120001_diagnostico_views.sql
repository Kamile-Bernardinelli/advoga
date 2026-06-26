-- =============================================================================
-- Advoga — Views de Diagnóstico (Motor de Correção & Diagnóstico, §8.3)
-- Migration: 20260621120001_diagnostico_views.sql
-- Author: Dara (@data-engineer) · 2026-06-21
-- Depends on: 20260621120000_init_schema.sql
-- =============================================================================
-- PURPOSE
--   Agregar `respostas` por nó (matéria / subtema / micro / QUALQUER dimensão)
--   e expor taxa = acertos/feitas, n_feitas, tendência. Mais a view CROSS-AXIS
--   (subtema × dimensão) — "a mágica" do §8.3.
--
-- ANTI-CHUTE (§4) — GATE DE VOLUME EXPLÍCITO
--   NUNCA declarar fraqueza com amostra pequena. O gate (default >= 8) NÃO é
--   um filtro escondido: é a COLUNA/flag `amostra_suficiente` em cada view.
--   A camada de aplicação decide o que mostrar; o dado nunca mente sobre o
--   tamanho da amostra. (verbatim brief: "amostra insuficiente — vou te dar
--   mais disso para medir.")
--
-- GATE central: public.diag_gate_minimo() -> 8 (single source of truth).
--   Trocar o limiar = trocar 1 função, sem reescrever as views.
--
-- TENDÊNCIA
--   tendencia = taxa(metade recente das respostas) - taxa(metade antiga).
--   > 0 melhorando, < 0 piorando, ~0 estável. Sem chute (§8.3, dashboard evolução).
--
-- PERFORMANCE
--   Views regulares (não materializadas) no Drop 1: volume single-user é baixo
--   (~milhares de respostas) e os índices de 120000 cobrem as agregações.
--   Se/quando virar produto multi-user, promover diag_por_no -> MATERIALIZED
--   VIEW + REFRESH (nota no rodapé). Mantido como VIEW para tempo-real honesto.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. GATE DE VOLUME — single source of truth do limiar anti-chute (§4)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diag_gate_minimo()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT 8 $$;

COMMENT ON FUNCTION public.diag_gate_minimo() IS
  'Limiar anti-chute (§4): nº mínimo de questões feitas p/ declarar fraqueza. Default 8. Single source of truth.';

-- =============================================================================
-- 1. BASE — respostas corrigidas, enriquecidas com conteúdo da questão
--   Só `correta IS NOT NULL` (sessão finalizada -> gabarito liberado, §7).
--   Esta é a CTE-base reutilizada pelas views por-nó.
-- =============================================================================
CREATE OR REPLACE VIEW public.v_respostas_corrigidas AS
SELECT
  r.id            AS resposta_id,
  r.user_id,
  r.sessao_id,
  r.questao_id,
  r.correta,
  r.tempo_seg,
  r.ts,
  q.materia_id,
  q.subtema_id,
  q.micro_topico_id,
  q.validade_status
FROM public.respostas r
JOIN public.questoes  q ON q.id = r.questao_id
WHERE r.correta IS NOT NULL;

COMMENT ON VIEW public.v_respostas_corrigidas IS
  'Respostas já corrigidas (correta NOT NULL) + dados de conteúdo da questão. Base das agregações de diagnóstico.';

-- =============================================================================
-- 2. DIAGNÓSTICO POR NÓ — eixo unificado (matéria | subtema | micro | dimensão)
--   Espelha o esboço `diagnostico(user_id, eixo, no_id, n_feitas, n_acertos,
--   taxa, tendencia, ...)` do §8.2, mas como VIEW computada (sem drift).
--
--   Implementação: UNION ALL de 4 agregações, uma por tipo de eixo:
--     - 'materia', 'subtema', 'micro'  -> agregam por coluna de conteúdo
--     - '<chave da dimensão>'          -> agregam por valor de dimensão (EAV)
--
--   Cada linha traz `amostra_suficiente` (n_feitas >= gate) — o GATE EXPLÍCITO.
-- =============================================================================
CREATE OR REPLACE VIEW public.diag_por_no AS
WITH g AS (SELECT public.diag_gate_minimo() AS minimo),

-- 2.a EIXO DE CONTEÚDO: matéria
materia AS (
  SELECT
    vr.user_id,
    'materia'::text                                   AS eixo,
    vr.materia_id::text                               AS no_id,
    m.nome                                            AS no_nome,
    count(*)                                          AS n_feitas,
    count(*) FILTER (WHERE vr.correta)                AS n_acertos,
    min(vr.ts)                                        AS primeiro_ts,
    max(vr.ts)                                        AS ultimo_ts,
    -- tendência: taxa da metade recente - taxa da metade antiga (por nó/usuária)
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts >  median_split.mid)        AS taxa_recente,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts <= median_split.mid)        AS taxa_antiga
  FROM public.v_respostas_corrigidas vr
  JOIN public.materias m ON m.id = vr.materia_id
  JOIN LATERAL (
    SELECT (min(x.ts) + (max(x.ts) - min(x.ts)) / 2) AS mid
    FROM public.v_respostas_corrigidas x
    WHERE x.user_id = vr.user_id AND x.materia_id = vr.materia_id
  ) median_split ON true
  GROUP BY vr.user_id, vr.materia_id, m.nome, median_split.mid
),

-- 2.b EIXO DE CONTEÚDO: subtema
subtema AS (
  SELECT
    vr.user_id,
    'subtema'::text                                   AS eixo,
    vr.subtema_id::text                               AS no_id,
    s.nome                                            AS no_nome,
    count(*)                                          AS n_feitas,
    count(*) FILTER (WHERE vr.correta)                AS n_acertos,
    min(vr.ts)                                        AS primeiro_ts,
    max(vr.ts)                                        AS ultimo_ts,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts >  median_split.mid)        AS taxa_recente,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts <= median_split.mid)        AS taxa_antiga
  FROM public.v_respostas_corrigidas vr
  JOIN public.subtemas s ON s.id = vr.subtema_id
  JOIN LATERAL (
    SELECT (min(x.ts) + (max(x.ts) - min(x.ts)) / 2) AS mid
    FROM public.v_respostas_corrigidas x
    WHERE x.user_id = vr.user_id AND x.subtema_id = vr.subtema_id
  ) median_split ON true
  WHERE vr.subtema_id IS NOT NULL
  GROUP BY vr.user_id, vr.subtema_id, s.nome, median_split.mid
),

-- 2.c EIXO DE CONTEÚDO: micro-tópico
micro AS (
  SELECT
    vr.user_id,
    'micro'::text                                     AS eixo,
    vr.micro_topico_id::text                          AS no_id,
    mt.nome                                           AS no_nome,
    count(*)                                          AS n_feitas,
    count(*) FILTER (WHERE vr.correta)                AS n_acertos,
    min(vr.ts)                                        AS primeiro_ts,
    max(vr.ts)                                        AS ultimo_ts,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts >  median_split.mid)        AS taxa_recente,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts <= median_split.mid)        AS taxa_antiga
  FROM public.v_respostas_corrigidas vr
  JOIN public.micro_topicos mt ON mt.id = vr.micro_topico_id
  JOIN LATERAL (
    SELECT (min(x.ts) + (max(x.ts) - min(x.ts)) / 2) AS mid
    FROM public.v_respostas_corrigidas x
    WHERE x.user_id = vr.user_id AND x.micro_topico_id = vr.micro_topico_id
  ) median_split ON true
  WHERE vr.micro_topico_id IS NOT NULL
  GROUP BY vr.user_id, vr.micro_topico_id, mt.nome, median_split.mid
),

-- 2.d EIXOS TRANSVERSAIS (DIMENSÕES ABERTAS) — a parte que NÃO precisa de schema novo.
--   Qualquer dimensão tagueada vira nós de diagnóstico automaticamente.
--   eixo = dimensoes.chave (ex.: 'estilo_cognitivo'), no_id = identidade do valor.
--   Cobre os 3 tipos de valor (categórico/bool/num) via COALESCE em texto.
dimensao AS (
  SELECT
    vr.user_id,
    d.chave                                           AS eixo,
    -- no_id estável por tipo de valor:
    COALESCE(dv.id::text, qt.valor_bool::text, qt.valor_num::text) AS no_id,
    -- nome amigável do nó (valor categórico, ou o próprio bool/num):
    COALESCE(dv.valor, qt.valor_bool::text, qt.valor_num::text)    AS no_nome,
    count(*)                                          AS n_feitas,
    count(*) FILTER (WHERE vr.correta)                AS n_acertos,
    min(vr.ts)                                        AS primeiro_ts,
    max(vr.ts)                                        AS ultimo_ts,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts >  median_split.mid)        AS taxa_recente,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts <= median_split.mid)        AS taxa_antiga
  FROM public.v_respostas_corrigidas vr
  JOIN public.questao_tags qt ON qt.questao_id = vr.questao_id
  JOIN public.dimensoes    d  ON d.id = qt.dimensao_id AND d.ativa
  LEFT JOIN public.dimensao_valores dv ON dv.id = qt.valor_id
  JOIN LATERAL (
    SELECT (min(x.ts) + (max(x.ts) - min(x.ts)) / 2) AS mid
    FROM public.v_respostas_corrigidas x
    JOIN public.questao_tags xqt ON xqt.questao_id = x.questao_id
    WHERE x.user_id = vr.user_id
      AND xqt.dimensao_id = qt.dimensao_id
      AND COALESCE(xqt.valor_id::text, xqt.valor_bool::text, xqt.valor_num::text)
        = COALESCE(qt.valor_id::text, qt.valor_bool::text, qt.valor_num::text)
  ) median_split ON true
  GROUP BY vr.user_id, d.chave,
           COALESCE(dv.id::text, qt.valor_bool::text, qt.valor_num::text),
           COALESCE(dv.valor, qt.valor_bool::text, qt.valor_num::text)
),

unioned AS (
  SELECT * FROM materia
  UNION ALL SELECT * FROM subtema
  UNION ALL SELECT * FROM micro
  UNION ALL SELECT * FROM dimensao
)
SELECT
  u.user_id,
  u.eixo,
  u.no_id,
  u.no_nome,
  u.n_feitas,
  u.n_acertos,
  -- taxa = acertos/feitas (NULL-safe; n_feitas nunca 0 aqui pois vem de GROUP BY)
  round(u.n_acertos::numeric / NULLIF(u.n_feitas, 0), 4)            AS taxa,
  -- GATE EXPLÍCITO anti-chute: a flag que a aplicação DEVE respeitar (§4).
  (u.n_feitas >= g.minimo)                                          AS amostra_suficiente,
  g.minimo                                                          AS gate_minimo,
  -- tendência: + melhora, - piora. NULL se uma das metades está vazia.
  CASE
    WHEN u.taxa_recente IS NULL OR u.taxa_antiga IS NULL THEN NULL
    ELSE round(u.taxa_recente - u.taxa_antiga, 4)
  END                                                               AS tendencia,
  u.primeiro_ts,
  u.ultimo_ts,
  now()                                                             AS atualizado_em
FROM unioned u
CROSS JOIN g
WHERE u.no_id IS NOT NULL;

COMMENT ON VIEW public.diag_por_no IS
  'Diagnóstico unificado por nó (materia|subtema|micro|<dimensão aberta>). taxa, tendência e GATE EXPLÍCITO amostra_suficiente (§4 anti-chute). Dimensões entram sem schema novo (§8.5).';

-- =============================================================================
-- 3. CROSS-AXIS (a mágica, §8.3): taxa por (subtema × dimensão)
--   "erra Posse quando é caso-concreto; acerta a letra de lei."
--   Cada combinação subtema × (dimensão+valor) tem sua própria taxa + gate.
-- =============================================================================
CREATE OR REPLACE VIEW public.diag_cross_subtema_dimensao AS
WITH g AS (SELECT public.diag_gate_minimo() AS minimo)
SELECT
  vr.user_id,
  vr.subtema_id,
  s.nome                                              AS subtema_nome,
  s.materia_id,
  d.chave                                             AS dimensao_chave,
  d.nome                                              AS dimensao_nome,
  COALESCE(dv.id::text, qt.valor_bool::text, qt.valor_num::text) AS valor_id,
  COALESCE(dv.valor, qt.valor_bool::text, qt.valor_num::text)    AS valor_nome,
  count(*)                                            AS n_feitas,
  count(*) FILTER (WHERE vr.correta)                  AS n_acertos,
  round(count(*) FILTER (WHERE vr.correta)::numeric
        / NULLIF(count(*), 0), 4)                     AS taxa,
  (count(*) >= g.minimo)                              AS amostra_suficiente,
  g.minimo                                            AS gate_minimo,
  max(vr.ts)                                          AS ultimo_ts,
  now()                                               AS atualizado_em
FROM public.v_respostas_corrigidas vr
JOIN public.subtemas     s  ON s.id  = vr.subtema_id
JOIN public.questao_tags qt ON qt.questao_id = vr.questao_id
JOIN public.dimensoes    d  ON d.id  = qt.dimensao_id AND d.ativa
LEFT JOIN public.dimensao_valores dv ON dv.id = qt.valor_id
CROSS JOIN g
WHERE vr.subtema_id IS NOT NULL
GROUP BY vr.user_id, vr.subtema_id, s.nome, s.materia_id,
         d.chave, d.nome,
         COALESCE(dv.id::text, qt.valor_bool::text, qt.valor_num::text),
         COALESCE(dv.valor, qt.valor_bool::text, qt.valor_num::text),
         g.minimo;

COMMENT ON VIEW public.diag_cross_subtema_dimensao IS
  'CROSS-AXIS (§8.3): taxa por subtema × dimensão. Revela "erra Posse em caso-concreto, acerta letra-de-lei". Gate explícito por célula.';

-- =============================================================================
-- 4. WEAKNESS SCORE (§8.3): f((1 - taxa), confiança_de_volume, peso_incidência)
--   Ordena alvos de reforço — só entre nós com amostra suficiente (anti-chute).
--   Aqui ligamos diag_por_no (eixo='materia') ao peso de incidência (§6),
--   que é o sinal de PRIORIZAÇÃO que o planner usa (incidência × fraqueza, §8.4).
--   Subtema/micro/dimensão também aparecem; peso herda da matéria do subtema
--   quando aplicável, senão neutro (1).
-- =============================================================================
CREATE OR REPLACE VIEW public.diag_weakness_score AS
SELECT
  dn.user_id,
  dn.eixo,
  dn.no_id,
  dn.no_nome,
  dn.n_feitas,
  dn.taxa,
  dn.tendencia,
  dn.amostra_suficiente,
  -- peso de incidência: matéria usa seu próprio peso; demais eixos = 1 (neutro)
  -- (refinável no planner; aqui expomos o sinal cru).
  COALESCE(m.questoes_por_prova, 1)::numeric          AS peso_incidencia,
  -- confiança de volume: satura em 1.0 a partir de ~2x o gate (heurística simples).
  LEAST(1.0, dn.n_feitas::numeric
        / NULLIF(public.diag_gate_minimo() * 2, 0))   AS confianca_volume,
  -- weakness_score = (1 - taxa) * confiança_volume * peso_incidencia
  --   só significativo quando amostra_suficiente = true (a app filtra).
  round(
    (1 - COALESCE(dn.taxa, 0))
    * LEAST(1.0, dn.n_feitas::numeric / NULLIF(public.diag_gate_minimo() * 2, 0))
    * COALESCE(m.questoes_por_prova, 1)
  , 4)                                                 AS weakness_score,
  now()                                                AS atualizado_em
FROM public.diag_por_no dn
-- liga peso de incidência quando o nó É uma matéria
LEFT JOIN public.materias m
  ON dn.eixo = 'materia' AND m.id::text = dn.no_id;

COMMENT ON VIEW public.diag_weakness_score IS
  'Weakness score (§8.3): (1-taxa) × confiança_volume × peso_incidência. Ordena alvos. App deve filtrar amostra_suficiente=true (anti-chute §4).';

COMMIT;

-- =============================================================================
-- NOTA DE EVOLUÇÃO (multi-user / escala)
--   Quando o volume crescer (produto vendável), promover diag_por_no e
--   diag_cross_subtema_dimensao para MATERIALIZED VIEW:
--     CREATE MATERIALIZED VIEW mv_diag_por_no AS SELECT * FROM diag_por_no;
--     CREATE UNIQUE INDEX ... ON mv_diag_por_no (user_id, eixo, no_id);
--     REFRESH MATERIALIZED VIEW CONCURRENTLY mv_diag_por_no;  -- pós-correção
--   No Drop 1 (single-user, baixo volume) VIEW regular dá tempo-real honesto.
-- =============================================================================
