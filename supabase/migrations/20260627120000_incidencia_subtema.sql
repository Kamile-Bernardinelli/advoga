-- =============================================================================
-- Advoga — Drop 2.5: Incidência de subtema (fato: COUNT de questões/subtema)
-- Migration: 20260627120000_incidencia_subtema.sql
-- Author: Dara (@data-engineer) · Design: Aria (@architect)
-- Depends on: 20260621120000 (subtemas/materias/questoes), 120003 (questoes_prova)
-- =============================================================================
-- PURPOSE
--   Sinal de PRIORIZAÇÃO por subtema: quantas questões de cada subtema caíram
--   nos exames ingeridos. É o equivalente de materias.questoes_por_prova, mas
--   COMPUTADO (sem coluna manual): COUNT(questoes) por subtema.
--
--   n_questoes      = incidência histórica (TODAS as questões do subtema) → pesoIncidencia
--   n_disponiveis   = subconjunto respondível AGORA (validade vigente|em_revisao,
--                     espelha questoes_prova) → honestidade do loop (treino vazio?)
--
-- ANTI-CHUTE: este é um FATO do corpus (não da usuária, sem user_id). A priorização
--   por fraqueza entra DEPOIS, no merge com diag_por_no (eixo='subtema'), no app.
-- ADITIVO: CREATE OR REPLACE VIEW; nenhum ALTER/DROP. Seguro re-rodar.
-- =============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_incidencia_subtema
WITH (security_invoker=on) AS
SELECT
  s.id                                            AS subtema_id,
  s.nome                                          AS subtema_nome,
  s.materia_id                                    AS materia_id,
  m.nome                                          AS materia_nome,
  count(q.id)                                     AS n_questoes,       -- incidência (todas)
  count(q.id) FILTER (
    WHERE q.validade_status IN ('vigente', 'em_revisao')
  )                                               AS n_disponiveis,    -- respondíveis agora
  now()                                           AS atualizado_em
FROM public.subtemas s
JOIN public.materias m ON m.id = s.materia_id
JOIN public.questoes q ON q.subtema_id = s.id     -- INNER: só subtemas COBRADOS (incidência>0)
GROUP BY s.id, s.nome, s.materia_id, m.nome;

COMMENT ON VIEW public.v_incidencia_subtema IS
  'Drop 2.5: incidência de subtema = COUNT(questoes) por subtema (fato do corpus, sem user_id). '
  'n_questoes = pesoIncidencia do planner; n_disponiveis = respondíveis (espelha questoes_prova). '
  'INNER JOIN questoes → só subtemas cobrados. security_invoker=on (padrão D-6).';

COMMIT;

-- =============================================================================
-- PÓS-MIGRATION (processo, não DDL):
--   supabase gen types typescript --local > src/lib/types/db.types.ts
--   (adiciona a Row de v_incidencia_subtema; NÃO editar db.types.ts à mão)
-- =============================================================================
