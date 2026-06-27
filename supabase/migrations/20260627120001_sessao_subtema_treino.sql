-- =============================================================================
-- Advoga — Drop 2.5: sessão de treino escopada por subtema (loop de desempenho)
-- Migration: 20260627120001_sessao_subtema_treino.sql
-- Depends on: 20260621120000 (sessoes, subtemas)
-- ADITIVO: ADD COLUMN IF NOT EXISTS; nenhum ALTER destrutivo. RLS de sessoes já cobre.
-- =============================================================================
BEGIN;

ALTER TABLE public.sessoes
  ADD COLUMN IF NOT EXISTS subtema_id uuid REFERENCES public.subtemas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sessoes.subtema_id IS
  'Drop 2.5: escopo de uma sessão tipo=treino filtrada por subtema (loop do cronograma). '
  'NULL em prova_oficial/simulado (exame inteiro via exame_id). Mutuamente exclusivo com exame_id na prática.';

CREATE INDEX IF NOT EXISTS idx_sessoes_subtema ON public.sessoes (subtema_id);

COMMIT;
-- PÓS: supabase gen types typescript --local > src/lib/types/db.types.ts
