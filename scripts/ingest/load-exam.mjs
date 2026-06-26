#!/usr/bin/env node
/**
 * load-exam.mjs
 * Ingest loader for OAB exam JSON files.
 *
 * Flow:
 *   1. UPSERT one row into `exames` (keyed by edicao + tipo_prova)
 *   2. INSERT 80 rows into `questoes` (keyed by exame_id + num_prova)
 *      — materia_id / subtema_id stay NULL (tagging fills them later)
 *
 * Usage:
 *   node scripts/ingest/load-exam.mjs <path-to-json> [db-url]
 *
 * Default DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
 */

import { readFileSync } from 'fs';
import pg from 'pg';

const { Pool } = pg;

// ── CLI args ─────────────────────────────────────────────────────────────────

const [,, jsonPath, dbUrl] = process.argv;

if (!jsonPath) {
  console.error('Usage: node load-exam.mjs <path-to-json> [db-url]');
  process.exit(1);
}

const DATABASE_URL = dbUrl ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// ── Parse input ───────────────────────────────────────────────────────────────

const raw = readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

const { exame, questoes } = data;

if (!exame || !Array.isArray(questoes) || questoes.length === 0) {
  console.error('Invalid JSON structure: expected { exame, questoes[] }');
  process.exit(1);
}

console.log(`Loaded JSON: exame OAB-${exame.numero} tipo ${exame.tipo} (${questoes.length} questoes)`);

// ── Map tipo number → tipo_prova enum ────────────────────────────────────────

function mapTipoProva(tipo) {
  if (tipo === 1) return 'prova_oficial';
  if (tipo === 2) return 'segunda_fase';
  return 'simulado';
}

// ── DB pool ───────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: DATABASE_URL });

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. UPSERT exame ──────────────────────────────────────────────────────
    // Unique constraint: (edicao, tipo_prova)
    // `edicao` maps from exame.numero (edition number in the OAB sequence)

    const tipoProva = mapTipoProva(exame.tipo);

    const exameRes = await client.query(
      `INSERT INTO exames (edicao, ano, tipo_prova, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (edicao, tipo_prova)
       DO UPDATE SET
         ano      = EXCLUDED.ano,
         data     = EXCLUDED.data,
         updated_at = now()
       RETURNING id`,
      [
        exame.numero,                         // $1 edicao
        exame.ano,                            // $2 ano
        tipoProva,                            // $3 tipo_prova
        exame.data_aplicacao ?? null,         // $4 data
      ]
    );

    const exameId = exameRes.rows[0].id;
    console.log(`Upserted exame: id=${exameId} edicao=${exame.numero} tipo=${tipoProva}`);

    // ── 2. INSERT questoes ───────────────────────────────────────────────────
    // Unique constraint: (exame_id, num_prova)
    // materia_id / subtema_id intentionally NULL — ultracode tags afterwards.
    // gabarito must be one of A/B/C/D (CHECK constraint in schema).
    // validade_status defaults to 'em_revisao'; we force 'vigente' on load
    // so the view questoes_prova (which filters vigente|em_revisao) sees them.

    let inserted = 0;
    let updated = 0;

    for (const q of questoes) {
      const { A, B, C, D } = q.alternativas;

      // Questões anuladas: gabarito = NULL, validade_status = 'anulada'
      // Questões normais: gabarito = A/B/C/D, validade_status = 'vigente'
      const isAnulada = q.gabarito === 'ANULADA' || q.gabarito === null || q.gabarito === '';
      const gabaritoVal = isAnulada ? null : q.gabarito;
      const validadeStatus = isAnulada ? 'anulada' : 'vigente';
      const validadeMotivo = isAnulada ? 'Questão anulada pelo gabarito oficial' : null;

      const res = await client.query(
        `INSERT INTO questoes
           (exame_id, num_prova, enunciado, alt_a, alt_b, alt_c, alt_d,
            gabarito, validade_status, validade_motivo, fonte_url,
            materia_id, subtema_id)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11,
            NULL, NULL)
         ON CONFLICT (exame_id, num_prova)
         DO UPDATE SET
           enunciado       = EXCLUDED.enunciado,
           alt_a           = EXCLUDED.alt_a,
           alt_b           = EXCLUDED.alt_b,
           alt_c           = EXCLUDED.alt_c,
           alt_d           = EXCLUDED.alt_d,
           gabarito        = EXCLUDED.gabarito,
           validade_status = EXCLUDED.validade_status,
           validade_motivo = EXCLUDED.validade_motivo,
           fonte_url       = EXCLUDED.fonte_url,
           updated_at      = now()
         RETURNING (xmax = 0) AS is_insert`,
        [
          exameId,            // $1
          q.num,              // $2 num_prova
          q.enunciado,        // $3
          A,                  // $4
          B,                  // $5
          C,                  // $6
          D,                  // $7
          gabaritoVal,        // $8  NULL se anulada, senão A/B/C/D
          validadeStatus,     // $9  'anulada' ou 'vigente'
          validadeMotivo,     // $10 motivo da anulação ou NULL
          null,               // $11 fonte_url — desconhecida no load
        ]
      );

      if (res.rows[0].is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');
    console.log(`Done: ${inserted} inserted, ${updated} updated (idempotent re-runs counted as updated)`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back due to error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
