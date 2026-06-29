/**
 * export-all-tags.mjs — re-exporta data/tags/all-tags.json a partir do banco (fonte de verdade).
 * Inverso do apply-tags-batch: lê questoes + questao_tags e gera o snapshot {count,porEdicao,tags}.
 * Uso: node scripts/ingest/export-all-tags.mjs [db-url]   (default: env DATABASE_URL ou local)
 */
import pg from 'pg';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../../data/tags/all-tags.json');

const DB = process.argv[2] || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const pool = new pg.Pool({ connectionString: DB });

async function main() {
  const c = await pool.connect();
  try {
    const base = (await c.query(`
      SELECT e.edicao, q.num_prova AS num, m.slug AS materia_slug, s.slug AS subtema_slug, q.id AS qid
      FROM questoes q
      JOIN exames e ON e.id = q.exame_id
      LEFT JOIN materias m ON m.id = q.materia_id
      LEFT JOIN subtemas s ON s.id = q.subtema_id
      ORDER BY e.edicao, q.num_prova
    `)).rows;

    const tagRows = (await c.query(`
      SELECT qt.questao_id, d.chave AS dim, dv.valor AS valor
      FROM questao_tags qt
      JOIN dimensoes d ON d.id = qt.dimensao_id
      LEFT JOIN dimensao_valores dv ON dv.id = qt.valor_id
    `)).rows;

    const byQ = {};
    for (const t of tagRows) {
      byQ[t.questao_id] = byQ[t.questao_id] || { estilo: null, dims: [] };
      if (t.dim === 'estilo_cognitivo' && t.valor) byQ[t.questao_id].estilo = t.valor;
      else if (t.dim !== 'estilo_cognitivo') byQ[t.questao_id].dims.push(t.dim);
    }

    const tags = base.map((r) => ({
      edicao: r.edicao,
      num: r.num,
      materia_slug: r.materia_slug,
      subtema_slug: r.subtema_slug,
      estilo_cognitivo: (byQ[r.qid] || {}).estilo || null,
      dimensoes: ((byQ[r.qid] || {}).dims || []).sort(),
    }));

    const porEdicao = {};
    for (const t of tags) porEdicao[t.edicao] = (porEdicao[t.edicao] || 0) + 1;

    const out = {
      count: tags.length,
      generated_at: new Date().toISOString(),
      porEdicao,
      source: 'pg-export from cloud supabase (janela recente ed37-46)',
      tags,
    };
    writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
    const untagged = tags.filter((t) => !t.materia_slug || !t.subtema_slug);
    console.log(`exported ${tags.length} tags → ${OUT_PATH}`);
    console.log('porEdicao:', JSON.stringify(porEdicao));
    console.log('sem materia/subtema:', untagged.length, untagged.slice(0, 20).map((t) => t.edicao + '/' + t.num));
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
