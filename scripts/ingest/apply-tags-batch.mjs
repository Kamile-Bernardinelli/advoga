/**
 * apply-tags-batch.mjs — aplica as tags do workflow de tagging em LOTE (várias edições).
 * Uso: node scripts/ingest/apply-tags-batch.mjs <arquivo-output-do-workflow>
 *
 * Lê o resultado do workflow ({count, porEdicao, tags:[{edicao,num,materia_slug,
 * subtema_slug,estilo_cognitivo,dimensoes}]}) e aplica por (edicao,num):
 *   1. UPDATE questoes: materia_id + subtema_id (via slug)
 *   2. INSERT questao_tags: estilo_cognitivo (categórica→valor_id) + dimensões booleanas
 * Idempotente. Anti-chute: reporta slugs não encontrados, não inventa.
 */
import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;

const outFile = process.argv[2];
const dbUrlArg = process.argv[3];
if (!outFile) { console.error('Uso: node apply-tags-batch.mjs <workflow-output-file> [db-url]'); process.exit(1); }

// Extrai o objeto-resultado {count,...,tags:[...]} de dentro do output (pode ter texto ao redor)
function extractResult(raw) {
  const idx = raw.lastIndexOf('"count"');
  if (idx === -1) throw new Error('não achei "count" no output — workflow não retornou tags?');
  const start = raw.lastIndexOf('{', idx);
  let depth = 0, end = -1;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error('JSON do resultado malformado');
  return JSON.parse(raw.slice(start, end + 1));
}

const normalizeEstiloSlug = (raw) => (raw || '').replace(/_/g, '-');

const pool = new Pool({ connectionString: dbUrlArg || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });

async function main() {
  const result = extractResult(readFileSync(outFile, 'utf8'));
  const tags = result.tags || [];
  console.log(`Tags lidas: ${tags.length} | porEdicao: ${JSON.stringify(result.porEdicao || {})}`);

  const client = await pool.connect();
  try {
    const materiaMap = Object.fromEntries((await client.query('SELECT id, slug FROM materias')).rows.map(r => [r.slug, r.id]));
    const subtemaMap = Object.fromEntries((await client.query('SELECT id, slug FROM subtemas')).rows.map(r => [r.slug, r.id]));
    const dimensaoMap = Object.fromEntries((await client.query('SELECT id, chave FROM dimensoes')).rows.map(r => [r.chave, r.id]));
    const dvRes = await client.query(`SELECT dv.id, d.chave dim_chave, dv.valor FROM dimensao_valores dv JOIN dimensoes d ON d.id=dv.dimensao_id`);
    const dvMap = Object.fromEntries(dvRes.rows.map(r => [`${r.dim_chave}|${r.valor}`, r.id]));
    const estiloDimId = dimensaoMap['estilo_cognitivo'];

    const byEd = {};
    for (const t of tags) (byEd[t.edicao] = byEd[t.edicao] || []).push(t);

    const unmatched = new Set();
    let totMat = 0, totSub = 0, totTags = 0;

    for (const edicao of Object.keys(byEd).sort((a, b) => Number(a) - Number(b))) {
      const exRes = await client.query(`SELECT id FROM exames WHERE edicao=$1 LIMIT 1`, [Number(edicao)]);
      if (!exRes.rows.length) { console.warn(`!! exame edicao=${edicao} não existe — pulando`); continue; }
      const exameId = exRes.rows[0].id;
      let mat = 0, sub = 0, tg = 0;

      for (const tag of byEd[edicao]) {
        const materiaId = materiaMap[tag.materia_slug] ?? null;
        const subtemaId = subtemaMap[tag.subtema_slug] ?? null;
        if (!materiaId) unmatched.add('materia:' + tag.materia_slug); else mat++;
        if (!subtemaId) unmatched.add('subtema:' + tag.subtema_slug); else sub++;

        await client.query(
          `UPDATE questoes SET materia_id=$1, subtema_id=$2, updated_at=now() WHERE exame_id=$3 AND num_prova=$4`,
          [materiaId, subtemaId, exameId, tag.num]
        );

        const qRes = await client.query(`SELECT id FROM questoes WHERE exame_id=$1 AND num_prova=$2 LIMIT 1`, [exameId, tag.num]);
        if (!qRes.rows.length) continue;
        const questaoId = qRes.rows[0].id;

        const valorId = dvMap[`estilo_cognitivo|${normalizeEstiloSlug(tag.estilo_cognitivo)}`] ?? null;
        if (valorId && estiloDimId) {
          const r = await client.query(
            `INSERT INTO questao_tags (questao_id, dimensao_id, valor_id, origem) VALUES ($1,$2,$3,'llm')
             ON CONFLICT (questao_id, dimensao_id, valor_id) DO NOTHING`,
            [questaoId, estiloDimId, valorId]
          );
          tg += r.rowCount;
        } else if (tag.estilo_cognitivo) {
          unmatched.add('estilo:' + tag.estilo_cognitivo);
        }

        for (const dimChave of (tag.dimensoes || [])) {
          const dimId = dimensaoMap[dimChave] ?? null;
          if (!dimId) { unmatched.add('dim:' + dimChave); continue; }
          const r = await client.query(
            `INSERT INTO questao_tags (questao_id, dimensao_id, valor_bool, origem)
             SELECT $1,$2,true,'llm'
             WHERE NOT EXISTS (SELECT 1 FROM questao_tags WHERE questao_id=$1 AND dimensao_id=$2 AND valor_bool IS NOT DISTINCT FROM true AND valor_id IS NULL AND origem='llm')`,
            [questaoId, dimId]
          );
          tg += r.rowCount;
        }
      }
      console.log(`ed ${edicao}: materia ${mat}/${byEd[edicao].length}, subtema ${sub}, +${tg} tags`);
      totMat += mat; totSub += sub; totTags += tg;
    }

    console.log(`\nTOTAIS: materia ${totMat}, subtema ${totSub}, questao_tags +${totTags}`);
    if (unmatched.size) console.log('SLUGS NÃO ENCONTRADOS:', [...unmatched].join(', '));

    const fin = await client.query(`SELECT count(*) total, count(materia_id) tagd FROM questoes`);
    console.log(`\nBanco: ${fin.rows[0].tagd}/${fin.rows[0].total} questões tagueadas`);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
