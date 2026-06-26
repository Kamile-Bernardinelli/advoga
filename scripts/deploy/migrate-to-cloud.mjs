#!/usr/bin/env node
/**
 * scripts/deploy/migrate-to-cloud.mjs
 *
 * Deploy completo do banco Advoga para o Supabase cloud da Kamile.
 * Idempotente — pode ser re-rodado sem efeito colateral.
 * Parametrizado exclusivamente por variáveis de ambiente (sem hardcode de credencial).
 *
 * REQUER (env vars):
 *   CLOUD_DATABASE_URL    — PostgreSQL connection string do cloud (percent-encoded)
 *                           Exemplo: postgresql://postgres.xxxx:[senha]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
 *   CLOUD_SUPABASE_URL    — URL do projeto Supabase (https://<ref>.supabase.co)
 *   CLOUD_SERVICE_KEY     — Service Role key (secret) do projeto cloud
 *
 * USO:
 *   CLOUD_DATABASE_URL="..." \
 *   CLOUD_SUPABASE_URL="https://xxx.supabase.co" \
 *   CLOUD_SERVICE_KEY="eyJ..." \
 *   node scripts/deploy/migrate-to-cloud.mjs
 *
 * ETAPAS:
 *   1. Validação de env vars
 *   2. Migrations: supabase db push --db-url (todas as migrações em supabase/migrations/)
 *   3. Load exames: todos os data/structured/oab*_tipo1.json
 *   4. Apply tags: data/tags/all-tags.json → questoes + questao_tags (sem workflow)
 *   5. Seed user Kamile (auth.users via Admin API)
 *   6. Seed metas_estudo (config singleton da Kamile)
 */

import { execSync, execFileSync } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ─────────────────────────────────────────────────────────────────────────────
// 0. HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const log = (step, msg) => console.log(`\n[${step}] ${msg}`);
const ok  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);
const fail = (msg) => { console.error(`  ✗ ${msg}`); process.exit(1); };

function elapsed(start) {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. VALIDAÇÃO DE ENV VARS
// ─────────────────────────────────────────────────────────────────────────────

log('ENV', 'Validando variáveis de ambiente...');

const CLOUD_DB_URL      = process.env.CLOUD_DATABASE_URL;
const CLOUD_SUPABASE_URL = process.env.CLOUD_SUPABASE_URL;
const CLOUD_SERVICE_KEY  = process.env.CLOUD_SERVICE_KEY;

if (!CLOUD_DB_URL)       fail('CLOUD_DATABASE_URL ausente. Exemplo: postgresql://postgres.xxx:[senha]@aws-0-us-east-1.pooler.supabase.com:6543/postgres');
if (!CLOUD_SUPABASE_URL) fail('CLOUD_SUPABASE_URL ausente. Exemplo: https://xxx.supabase.co');
if (!CLOUD_SERVICE_KEY)  fail('CLOUD_SERVICE_KEY ausente. Obtenha em: Settings → API → service_role (secret)');

if (!CLOUD_SUPABASE_URL.startsWith('https://')) fail('CLOUD_SUPABASE_URL deve começar com https://');
if (CLOUD_DB_URL.includes('@127') || CLOUD_DB_URL.includes('localhost')) {
  fail('CLOUD_DATABASE_URL aponta para localhost — isso é o DB local, não o cloud.');
}

ok(`CLOUD_SUPABASE_URL: ${CLOUD_SUPABASE_URL}`);
ok(`CLOUD_DATABASE_URL: ${CLOUD_DB_URL.replace(/:([^:@]+)@/, ':***@')}`);
ok('CLOUD_SERVICE_KEY: [presente, não exibida]');

// ─────────────────────────────────────────────────────────────────────────────
// 2. CARREGAR all-tags.json + DERIVAR EDIÇÕES VÁLIDAS (single source of truth)
// ─────────────────────────────────────────────────────────────────────────────
// O cloud deve espelhar o banco LOCAL exatamente. A verdade do que existe no
// local é o all-tags.json (edições efetivamente carregadas e tagueadas).
// Ed. 40 NÃO está no local (parser falhou no Q44 → não carregada por anti-chute),
// portanto NÃO aparece no all-tags.json e NÃO deve ser carregada no cloud.
// A lista de edições a carregar é DERIVADA daqui — nunca do glob de arquivos.

log('TAGS-FILE', 'Carregando data/tags/all-tags.json e derivando edições válidas...');

const tagsFile = join(ROOT, 'data', 'tags', 'all-tags.json');
if (!existsSync(tagsFile)) {
  fail(`Arquivo de tags não encontrado: ${tagsFile}\nDeploy abortado — sem all-tags.json não há como garantir cloud == local.`);
}

const tagsData = JSON.parse(readFileSync(tagsFile, 'utf8'));
const tags = tagsData.tags || [];
if (tags.length === 0) fail('all-tags.json está vazio — arquivo corrompido ou não exportado.');

// Allowlist de edições = conjunto das edições presentes no all-tags.json.
const ALLOWED_EDICOES = new Set(tags.map(t => Number(t.edicao)));
const allowedList = [...ALLOWED_EDICOES].sort((a, b) => a - b);

ok(`all-tags.json: ${tags.length} registros (gerado em: ${tagsData.generated_at || 'N/A'})`);
ok(`Edições válidas a carregar (${allowedList.length}): ${allowedList.join(', ')}`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. MIGRATIONS
// ─────────────────────────────────────────────────────────────────────────────

log('MIGRATIONS', 'Aplicando todas as migrations via supabase db push...');

const t2 = Date.now();
const migrationsDir = join(ROOT, 'supabase', 'migrations');
const migrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
ok(`${migrations.length} arquivos encontrados em supabase/migrations/:`);
migrations.forEach(f => console.log(`     ${f}`));

try {
  execSync(
    `supabase db push --db-url "${CLOUD_DB_URL}" --yes`,
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env },
    }
  );
  ok(`Migrations aplicadas (${elapsed(t2)})`);
} catch (err) {
  // Se falhar, tenta com --include-all (fresh project sem migration history)
  warn('db push falhou na primeira tentativa — retentando com --include-all...');
  try {
    execSync(
      `supabase db push --db-url "${CLOUD_DB_URL}" --yes --include-all`,
      {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env },
      }
    );
    ok(`Migrations aplicadas com --include-all (${elapsed(t2)})`);
  } catch (err2) {
    fail(`Migrations falharam: ${err2.message}\n\nFallback manual:\n  psql "$CLOUD_DATABASE_URL" -f supabase/migrations/XXXX.sql`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LOAD EXAMES (apenas edições válidas — cloud == local)
// ─────────────────────────────────────────────────────────────────────────────

log('EXAMES', 'Carregando questões das edições válidas (filtrado por all-tags.json)...');

const t3 = Date.now();
const structuredDir = join(ROOT, 'data', 'structured');

// Extrai o número da edição do nome do arquivo (oab{N}_tipo1.json).
const edicaoFromFile = (f) => {
  const m = f.match(/^oab(\d+)_tipo1\.json$/);
  return m ? Number(m[1]) : null;
};

const allExamFiles = readdirSync(structuredDir)
  .filter(f => /^oab\d+_tipo1\.json$/.test(f))
  .sort();

// SOMENTE edições presentes no all-tags.json (cloud espelha o local).
const examFiles = allExamFiles.filter(f => ALLOWED_EDICOES.has(edicaoFromFile(f)));
const skipped   = allExamFiles.filter(f => !ALLOWED_EDICOES.has(edicaoFromFile(f)));

ok(`${examFiles.length} arquivos a carregar (de ${allExamFiles.length} presentes em data/structured/)`);
if (skipped.length) {
  warn(`PULADOS (não estão no banco local / all-tags.json): ${skipped.join(', ')}`);
  warn('  → Ed. 40 é excluída de propósito (parser falhou no Q44; carregá-la deixaria cloud != local).');
}

const loadExamScript = join(ROOT, 'scripts', 'ingest', 'load-exam.mjs');
let totalInserted = 0;
let totalUpdated  = 0;

for (const file of examFiles) {
  const filePath = join(structuredDir, file);
  const tFile = Date.now();
  try {
    const output = execSync(
      `node "${loadExamScript}" "${filePath}" "${CLOUD_DB_URL}"`,
      { cwd: ROOT, encoding: 'utf8' }
    );
    // Extrai contagem do output: "Done: N inserted, M updated"
    const match = output.match(/Done: (\d+) inserted, (\d+) updated/);
    if (match) {
      totalInserted += parseInt(match[1]);
      totalUpdated  += parseInt(match[2]);
    }
    ok(`${file} → ${elapsed(tFile)}`);
  } catch (err) {
    fail(`Erro ao carregar ${file}: ${err.message}`);
  }
}

ok(`Total: ${totalInserted} novas questões inseridas, ${totalUpdated} atualizadas (idempotente) — ${elapsed(t3)}`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. APPLY TAGS (offline — sem workflow de tagging)
// ─────────────────────────────────────────────────────────────────────────────
// Reutiliza `tags` / `tagsData` já carregados e validados na seção 2.

log('TAGS', `Aplicando tags de data/tags/all-tags.json (${tags.length} questões, sem LLM)...`);

const t4 = Date.now();

const pool = new Pool({ connectionString: CLOUD_DB_URL });

async function applyTags() {
  const client = await pool.connect();
  try {
    // Carrega mapas de lookup
    const materiaMap  = Object.fromEntries((await client.query('SELECT id, slug FROM materias')).rows.map(r => [r.slug, r.id]));
    const subtemaMap  = Object.fromEntries((await client.query('SELECT id, slug FROM subtemas')).rows.map(r => [r.slug, r.id]));
    const dimensaoMap = Object.fromEntries((await client.query('SELECT id, chave FROM dimensoes')).rows.map(r => [r.chave, r.id]));
    const dvRes = await client.query(
      `SELECT dv.id, d.chave dim_chave, dv.valor FROM dimensao_valores dv JOIN dimensoes d ON d.id=dv.dimensao_id`
    );
    const dvMap = Object.fromEntries(dvRes.rows.map(r => [`${r.dim_chave}|${r.valor}`, r.id]));
    const estiloDimId = dimensaoMap['estilo_cognitivo'];

    // Agrupa por edição
    const byEd = {};
    for (const t of tags) (byEd[t.edicao] = byEd[t.edicao] || []).push(t);

    const unmatched = new Set();
    let totMat = 0, totSub = 0, totTags = 0, totSkip = 0;

    for (const edicao of Object.keys(byEd).sort((a, b) => Number(a) - Number(b))) {
      const exRes = await client.query(
        `SELECT id FROM exames WHERE edicao=$1 LIMIT 1`,
        [Number(edicao)]
      );
      if (!exRes.rows.length) {
        warn(`  Edição ${edicao} não encontrada no banco cloud — pulando`);
        continue;
      }
      const exameId = exRes.rows[0].id;
      let mat = 0, sub = 0, tg = 0;

      for (const tag of byEd[edicao]) {
        const materiaId = materiaMap[tag.materia_slug] ?? null;
        const subtemaId = subtemaMap[tag.subtema_slug] ?? null;
        if (!materiaId) unmatched.add('materia:' + tag.materia_slug); else mat++;
        if (!subtemaId) unmatched.add('subtema:' + tag.subtema_slug); else sub++;

        await client.query(
          `UPDATE questoes SET materia_id=$1, subtema_id=$2, updated_at=now()
           WHERE exame_id=$3 AND num_prova=$4`,
          [materiaId, subtemaId, exameId, tag.num]
        );

        const qRes = await client.query(
          `SELECT id FROM questoes WHERE exame_id=$1 AND num_prova=$2 LIMIT 1`,
          [exameId, tag.num]
        );
        if (!qRes.rows.length) { totSkip++; continue; }
        const questaoId = qRes.rows[0].id;

        // Estilo cognitivo (categórico → valor_id)
        const normalizeSlug = (s) => (s || '').replace(/_/g, '-');
        const valorId = dvMap[`estilo_cognitivo|${normalizeSlug(tag.estilo_cognitivo)}`] ?? null;
        if (valorId && estiloDimId) {
          const r = await client.query(
            `INSERT INTO questao_tags (questao_id, dimensao_id, valor_id, origem)
             VALUES ($1,$2,$3,'llm')
             ON CONFLICT (questao_id, dimensao_id, valor_id) DO NOTHING`,
            [questaoId, estiloDimId, valorId]
          );
          tg += r.rowCount;
        } else if (tag.estilo_cognitivo) {
          unmatched.add('estilo:' + tag.estilo_cognitivo);
        }

        // Dimensões booleanas
        for (const dimChave of (tag.dimensoes || [])) {
          const dimId = dimensaoMap[dimChave] ?? null;
          if (!dimId) { unmatched.add('dim:' + dimChave); continue; }
          const r = await client.query(
            `INSERT INTO questao_tags (questao_id, dimensao_id, valor_bool, origem)
             SELECT $1,$2,true,'llm'
             WHERE NOT EXISTS (
               SELECT 1 FROM questao_tags
               WHERE questao_id=$1 AND dimensao_id=$2
                 AND valor_bool IS NOT DISTINCT FROM true
                 AND valor_id IS NULL AND origem='llm'
             )`,
            [questaoId, dimId]
          );
          tg += r.rowCount;
        }
      }
      console.log(`     ed ${edicao}: materia ${mat}/${byEd[edicao].length}, subtema ${sub}, +${tg} questao_tags`);
      totMat += mat; totSub += sub; totTags += tg;
    }

    // Verify final count
    const fin = await client.query(
      `SELECT count(*) total, count(materia_id) tagd FROM questoes`
    );
    const { tagd, total } = fin.rows[0];

    ok(`Tags aplicadas: materia ${totMat}, subtema ${totSub}, questao_tags +${totTags} (${elapsed(t4)})`);
    ok(`Banco cloud: ${tagd}/${total} questões tagueadas`);
    if (totSkip)      warn(`${totSkip} questões puladas (não encontradas no cloud)`);
    if (unmatched.size) warn(`Slugs não encontrados (revisar): ${[...unmatched].join(', ')}`);

  } finally {
    client.release();
  }
}

await applyTags();

// ─────────────────────────────────────────────────────────────────────────────
// 6. SEED USER KAMILE
// ─────────────────────────────────────────────────────────────────────────────

log('USER', 'Criando/verificando usuária Kamile no Supabase Auth cloud...');

const t5 = Date.now();
const seedUserScript = join(ROOT, 'scripts', 'seed-user.mjs');

try {
  const output = execSync(
    `node "${seedUserScript}"`,
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: CLOUD_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: CLOUD_SERVICE_KEY,
      },
    }
  );
  process.stdout.write(output);
  ok(`Usuária Kamile OK (${elapsed(t5)})`);
} catch (err) {
  fail(`Erro ao criar usuária Kamile: ${err.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SEED METAS KAMILE
// ─────────────────────────────────────────────────────────────────────────────

log('METAS', 'Inserindo config de metas da Kamile (metas_estudo)...');

const t6 = Date.now();

async function seedMetas() {
  const client = await pool.connect();
  try {
    // Busca user_id da Kamile no banco cloud
    const userRes = await client.query(
      `SELECT id FROM auth.users WHERE email='kamile@advoga.local' LIMIT 1`
    );
    if (!userRes.rows.length) {
      warn('Usuária Kamile não encontrada em auth.users — seed de metas pulado. Re-rode após seed-user.');
      return;
    }
    const userId = userRes.rows[0].id;

    // Insere metas_estudo (config singleton, idempotente)
    await client.query(
      `INSERT INTO public.metas_estudo
         (user_id, meta_base_diaria_min, meta_mensal_min, dias_estudo, timezone)
       VALUES ($1, $2, $3, $4::smallint[], $5)
       ON CONFLICT (user_id) DO UPDATE SET
         meta_base_diaria_min = EXCLUDED.meta_base_diaria_min,
         meta_mensal_min      = EXCLUDED.meta_mensal_min,
         dias_estudo          = EXCLUDED.dias_estudo,
         timezone             = EXCLUDED.timezone,
         updated_at           = now()`,
      [
        userId,
        240,                          // 4h/dia meta base
        3000,                         // 50h meta mensal
        '{0,1,2,3,4,5,6}',           // todos os dias (ajustável pela Kamile no app)
        'America/Sao_Paulo',
      ]
    );

    ok(`metas_estudo: user_id=${userId}, meta_base=240min/dia, meta_mensal=3000min/mês (${elapsed(t6)})`);
    ok('metas_diarias: não seedadas — overrides de dia são criados pelo app (efêmeros)');

  } finally {
    client.release();
  }
}

await seedMetas();
await pool.end();

// ─────────────────────────────────────────────────────────────────────────────
// RESUMO FINAL
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
console.log('DEPLOY COMPLETO');
console.log('═'.repeat(60));
console.log(`  Projeto: ${CLOUD_SUPABASE_URL}`);
console.log(`  Migrations aplicadas: supabase/migrations/ (${migrations.length} arquivos)`);
console.log(`  Exames carregados: ${examFiles.length} edições [${allowedList.join(', ')}]`);
console.log(`  Tags aplicadas: data/tags/all-tags.json (${tags.length} questões)`);
console.log(`  Usuária: kamile@advoga.local`);
console.log(`  Metas: 240min/dia, 3000min/mês, todos os dias`);
console.log('');
console.log('PRÓXIMO PASSO: configure as env vars no Vercel e faça o deploy.');
console.log('Ver: docs/setup/deploy-runbook.md');
console.log('═'.repeat(60));
