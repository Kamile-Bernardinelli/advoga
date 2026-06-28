-- =============================================================================
-- Advoga — Trend layer: Tendência de subtema (incidência TEMPORAL, por edição)
-- Migration: 20260628201154_tendencia_subtema.sql
-- Author: Dara (@data-engineer) · Design: Aria (@architect)
-- Depends on: 20260621120000 (subtemas/materias/questoes/exames),
--             20260627120000 (v_incidencia_subtema — versão CUMULATIVA)
-- =============================================================================
-- PURPOSE
--   v_incidencia_subtema responde "quantas questões de cada subtema caíram NO
--   TOTAL". Esta view responde "quantas caíram EM CADA EDIÇÃO" — a decomposição
--   temporal necessária para testar a hipótese de ROTAÇÃO da FGV (um subtema é
--   cobrado por ~3 anos e depois cede espaço a outro) versus a hipótese de
--   incidência estável (o que importa é só recência/volume).
--
--   Granularidade: UMA linha por par (subtema × edição cobrada).
--     exame_numero = exames.edicao (ex.: 38, 39, 41…)  -- eixo temporal
--     ano          = exames.ano                          -- contexto humano
--     n_questoes   = COUNT(questoes) do subtema NAQUELA edição
--
-- LEITURA HONESTA DA ESPARSIDADE (ANTI-CHUTE):
--   O JOIN produz só CÉLULAS NÃO-ZERO. Um par (subtema, edição) AUSENTE = 0
--   questões naquela edição — sinal real, não "missing". Consumidores que
--   montarem série temporal DEVEM densificar (subtemas × exames LEFT JOIN) para
--   reintroduzir os zeros, senão a série fica enviesada para cima.
--   No corpus atual a célula típica vale 1 questão (máx. 3): qualquer
--   "tendência" por subtema vive dentro do ruído de Poisson. Esta view é só o
--   FATO temporal; o juízo estatístico fica fora dela (ver docs/analysis).
--
-- ESCOPO: este é um FATO do corpus (sem user_id). Nenhuma priorização aqui.
-- ADITIVO: CREATE OR REPLACE VIEW; nenhum ALTER/DROP. Seguro re-rodar.
-- =============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_tendencia_subtema
WITH (security_invoker=on) AS
SELECT
  s.id            AS subtema_id,
  s.nome          AS subtema_nome,
  s.materia_id    AS materia_id,
  m.nome          AS materia_nome,
  e.edicao        AS exame_numero,   -- eixo temporal (exames.edicao)
  e.ano           AS ano,
  count(q.id)     AS n_questoes      -- incidência DO subtema NAQUELA edição
FROM public.subtemas s
JOIN public.materias m ON m.id = s.materia_id
JOIN public.questoes q ON q.subtema_id = s.id     -- INNER: só subtemas cobrados
JOIN public.exames   e ON e.id = q.exame_id       -- INNER: só edições ingeridas
GROUP BY s.id, s.nome, s.materia_id, m.nome, e.edicao, e.ano;

COMMENT ON VIEW public.v_tendencia_subtema IS
  'Trend layer: incidência TEMPORAL = COUNT(questoes) por (subtema x edição). '
  'Decomposição por edição de v_incidencia_subtema (cumulativa). exame_numero=exames.edicao (eixo temporal). '
  'Só células não-zero: par (subtema,edição) ausente = 0 questões; séries temporais devem densificar. '
  'Fato do corpus (sem user_id). security_invoker=on (padrão D-6).';

COMMIT;

-- =============================================================================
-- PÓS-MIGRATION (processo, não DDL):
--   supabase gen types typescript --local > src/lib/types/db.types.ts
--   (adiciona a Row de v_tendencia_subtema; NÃO editar db.types.ts à mão)
-- =============================================================================
