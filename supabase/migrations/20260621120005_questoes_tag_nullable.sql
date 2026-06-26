-- Migration: 20260621120005_questoes_tag_nullable
-- Purpose: Allow ingest loader to insert questoes without materia_id/subtema_id.
--          Tagging (ultracode) fills these columns AFTER initial load.
--          materia_id was NOT NULL — this drops that constraint so the flow
--          LOAD (text + gabarito, tags NULL) → TAG (ultracode sets ids) works.
--
-- Rollback: ALTER TABLE questoes ALTER COLUMN materia_id SET NOT NULL;
--           (only safe after verifying all rows have materia_id filled)

BEGIN;

ALTER TABLE questoes
  ALTER COLUMN materia_id DROP NOT NULL;

COMMIT;
