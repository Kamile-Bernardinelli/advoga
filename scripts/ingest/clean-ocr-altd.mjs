/**
 * clean-ocr-altd.mjs — remove lixo de rodapé do OCR que vazou na última alternativa (alt_d).
 * Padrões: "TIPO 1 — BRANCA - Página N", "(W7 )FGV CONHECIMENTO XXXVII EXAME ...".
 * Uso: node scripts/ingest/clean-ocr-altd.mjs [db-url] [--apply]
 *   sem --apply = modo TESTE (mostra antes/depois, não grava).
 */
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const DB = process.argv.find((a) => a.startsWith('postgres')) || process.env.DATABASE_URL;

export function cleanAltD(s) {
  if (!s) return s;
  let r = s;
  r = r.replace(/\s*(W\S{0,3}\s+)?FGV\b.*$/u, '');        // "(W7 )FGV CONHECIMENTO XXXVII EXAME ..."
  r = r.replace(/\s*CONHECIMENTO\b.*$/u, '');             // "CONHECIMENTO ..." solto (caps = rodapé)
  // "TIPO 1 — Branca…", "TIPO BRANCA…", "Co/o Tipo Branca…" (prefixo-lixo ≤3 chars; sem \b que quebrava o match)
  r = r.replace(/\s*(\S{1,3}\s+)?TIPO\s+(\d\s*[—–-]|(\d\s+)?(BRANCA|VERDE|AMARELO|AZUL)).*$/iu, '');
  r = r.replace(/\s*X{0,5}V*I*\s*EXAME\s+D[EO]\s+ORDEM.*$/iu, '');  // "XXXVII EXAME DO ORDEM ..." solto
  r = r.replace(/\s*P[ÁA]GINA\s+\d+.*$/iu, '');           // "Página N / PÁGINA N ..." solto
  r = r.replace(/\s+(SAB( O rm)?|O rm)\s*$/u, '');        // lixo final "SAB"/"O rm"
  r = r.replace(/\s+$/u, '');                             // trim final
  return r;
}

async function main() {
  const pool = new pg.Pool({ connectionString: DB });
  const c = await pool.connect();
  try {
    const rows = (await c.query("select id, alt_d from questoes where alt_d ~ 'FGV|CONHECIMENTO|TIPO|Tipo|P[ÁA]GINA|Página|EXAME D[EO] ORDEM'")).rows;
    let changed = 0, suspeito = 0;
    const samples = [];
    for (const row of rows) {
      const cleaned = cleanAltD(row.alt_d);
      if (cleaned !== row.alt_d) {
        changed++;
        // sanity: a alternativa limpa não pode ficar vazia ou curta demais
        if (cleaned.trim().length < 5) suspeito++;
        if (samples.length < 14) samples.push({ b: row.alt_d.slice(-50), a: cleaned.slice(-50) });
        if (APPLY) await c.query('update questoes set alt_d=$1, updated_at=now() where id=$2', [cleaned, row.id]);
      }
    }
    console.log(`candidatas: ${rows.length} | mudadas: ${changed} | suspeitas(<5 chars): ${suspeito} | ${APPLY ? 'APLICADO ✅' : 'TESTE (sem gravar)'}`);
    for (const s of samples) console.log(`  ANTES: …${s.b}\n  DEPOIS:…${s.a}\n`);
    // residual após limpeza (deve zerar no apply)
    if (APPLY) {
      const left = (await c.query("select count(*) n from questoes where alt_d ~ 'FGV|TIPO [1-4] —|CONHECIMENTO'")).rows[0].n;
      console.log('residual com lixo após apply:', left);
    }
  } finally {
    c.release();
    await pool.end();
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
}
