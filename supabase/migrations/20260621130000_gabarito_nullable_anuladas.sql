-- Migration: Permite gabarito NULL para questões anuladas
-- Contexto: edições OAB com questões anuladas não têm gabarito válido (A/B/C/D).
-- A coluna gabarito era NOT NULL char(1) com CHECK IN(A,B,C,D).
-- Agora: gabarito pode ser NULL quando validade_status = 'anulada'.
-- CHECK atualizado para exigir gabarito somente quando não é NULL.

-- 1. Remover constraint NOT NULL do gabarito
ALTER TABLE questoes ALTER COLUMN gabarito DROP NOT NULL;

-- 2. Remover CHECK constraint antigo (só permitia A/B/C/D)
ALTER TABLE questoes DROP CONSTRAINT questoes_gabarito_check;

-- 3. Adicionar CHECK atualizado:
--    - Se gabarito não é NULL, deve ser A/B/C/D
--    - Se gabarito é NULL, validade_status deve ser 'anulada'
ALTER TABLE questoes ADD CONSTRAINT questoes_gabarito_check CHECK (
  (gabarito IS NOT NULL AND gabarito = ANY (ARRAY['A'::bpchar, 'B'::bpchar, 'C'::bpchar, 'D'::bpchar]))
  OR
  (gabarito IS NULL AND validade_status = 'anulada')
);

COMMENT ON COLUMN questoes.gabarito IS
  'Resposta correta (A/B/C/D). NULL quando a questão foi anulada (validade_status=anulada).';
