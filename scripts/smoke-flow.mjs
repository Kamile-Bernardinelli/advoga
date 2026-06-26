// Smoke test do loop de correção (Drop 1) — prova que corrigir_sessao() funciona
// contra o gabarito real, sem precisar de browser. Roda no banco LOCAL e limpa depois.
// Uso: node scripts/smoke-flow.mjs
import pg from 'pg'

const URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const KAMILE = 'ea7c5c9d-5bf3-402b-a3bb-0fed4a015685' // kamile@advoga.local (auth.users)

const c = new pg.Client({ connectionString: URL })
await c.connect()
let sessId = null
try {
  const exame = (await c.query('select id from exames order by created_at limit 1')).rows[0]
  if (!exame) throw new Error('sem exame carregado')

  const qs = (await c.query(
    'select id, num_prova, gabarito from questoes where exame_id=$1 order by num_prova limit 10',
    [exame.id]
  )).rows
  if (qs.length < 10) throw new Error(`esperava 10 questões, achei ${qs.length}`)

  sessId = (await c.query(
    "insert into sessoes(user_id, tipo, exame_id, inicio) values ($1,'prova_oficial',$2, now()) returning id",
    [KAMILE, exame.id]
  )).rows[0].id

  const letters = ['A', 'B', 'C', 'D']
  let esperadoCertas = 0
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i]
    const gab = (q.gabarito || '').trim()
    let resp
    if (i < 7) { resp = gab; esperadoCertas++ }                 // 7 corretas
    else { resp = letters.find((l) => l !== gab) }              // 3 erradas (letra != gabarito)
    await c.query(
      'insert into respostas(sessao_id, questao_id, user_id, resposta_dada) values ($1,$2,$3,$4)',
      [sessId, q.id, KAMILE, resp]
    )
  }

  await c.query('select corrigir_sessao($1)', [sessId])

  const r = (await c.query(
    `select count(*) filter (where correta) certas,
            count(*) filter (where correta is false) erradas,
            count(*) filter (where correta is null) sem_correcao,
            count(*) total
     from respostas where sessao_id=$1`,
    [sessId]
  )).rows[0]

  console.log('Resultado:', JSON.stringify(r), '| esperado certas =', esperadoCertas)
  const ok =
    Number(r.certas) === esperadoCertas &&
    Number(r.total) === 10 &&
    Number(r.sem_correcao) === 0
  console.log(ok ? '✅ corrigir_sessao() correto vs gabarito' : '❌ MISMATCH — investigar')
  if (!ok) process.exitCode = 1
} finally {
  if (sessId) {
    await c.query('delete from respostas where sessao_id=$1', [sessId])
    await c.query('delete from sessoes where id=$1', [sessId])
    console.log('(sessão de teste removida)')
  }
  await c.end()
}
