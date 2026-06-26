// Cria uma sessão-demo realista da Kamile (80 respondidas, ~55% acerto) e corrige.
// Serve para ver o diagnóstico por matéria + o gate de volume no resultado/dashboard.
// Uso: node scripts/demo-session.mjs   → imprime o sessaoId
import pg from 'pg'

const URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const KAMILE = 'ea7c5c9d-5bf3-402b-a3bb-0fed4a015685'

const c = new pg.Client({ connectionString: URL })
await c.connect()
try {
  const exame = (await c.query('select id from exames order by created_at limit 1')).rows[0]
  const qs = (await c.query(
    'select id, num_prova, gabarito from questoes where exame_id=$1 order by num_prova',
    [exame.id]
  )).rows

  const sess = (await c.query(
    "insert into sessoes(user_id, tipo, exame_id, inicio) values ($1,'simulado',$2, now() - interval '90 minutes') returning id",
    [KAMILE, exame.id]
  )).rows[0]

  const letters = ['A', 'B', 'C', 'D']
  let acertosPrev = 0
  for (const q of qs) {
    const gab = (q.gabarito || '').trim()
    // Padrão determinístico ~55% (varia por matéria por causa da ordem das questões)
    const acerta = q.num_prova % 2 === 0 || q.num_prova % 5 === 0
    const resp = acerta ? gab : letters.find((l) => l !== gab)
    if (acerta) acertosPrev++
    await c.query(
      'insert into respostas(sessao_id, questao_id, user_id, resposta_dada) values ($1,$2,$3,$4)',
      [sess.id, q.id, KAMILE, resp]
    )
  }

  await c.query('select corrigir_sessao($1)', [sess.id])

  const chk = (await c.query(
    'select count(*) filter (where correta) certas, count(*) total from respostas where sessao_id=$1',
    [sess.id]
  )).rows[0]

  console.log('DEMO_SESSAO_ID=' + sess.id)
  console.log('Programado ~certas:', acertosPrev, '| Corrigido:', JSON.stringify(chk))
} finally {
  await c.end()
}
