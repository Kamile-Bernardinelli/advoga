/**
 * Smoke test — Cockpit de Estudo, Drop 1.5, Fatia 1
 *
 * Verifica:
 *   1. Gera cronograma para Kamile (4h/dia) e persiste em cronograma_blocos
 *   2. Lê de volta: contagem, primeiros 8 blocos por (data_alvo, ordem)
 *   3. AUTO-VALIDA invariantes do BUG 1: prioridade lidera + conteúdo antes de questões
 *   4. Insere uma estudo_sessao e lê de volta
 *
 * O bloco de algoritmo abaixo ESPELHA src/lib/planner/cronograma.ts (two-phase
 * round-robin). A fonte da verdade do algoritmo são os testes unitários
 * (tests/unit/cronograma.test.ts) — este script só prova a persistência no DB e
 * AUTO-VALIDA os invariantes (falha alto se houver drift).
 *
 * Usa pg (conexão superuser) para bypass de RLS em smoke test.
 * Execute: node scripts/smoke-cronograma.mjs
 */

import pg from "pg";

const { Client } = pg;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DB_URL     = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const KAMILE_ID  = "ea7c5c9d-5bf3-402b-a3bb-0fed4a015685";
const HOJE       = new Date().toISOString().slice(0, 10);
const DATA_PROVA = "2026-09-06";
const HORAS_DIA  = 4;

// Espelham config.ts
const GATE_VOLUME = 8;
const VOL_CONF = 30;
const INC_MAX = 20;
const FRACAO_CONTEUDO = 0.6;
const PISO_ETICA_FRACAO = 0.15;
const PISO_ETICA_SEMANAL_MIN = 90;
const MAX_BLOCO_MIN = 60;
const FATOR_UTILIZACAO = 0.9;

// ---------------------------------------------------------------------------
// Algoritmo de cronograma (inline — ESPELHA cronograma.ts; two-phase round-robin)
// ---------------------------------------------------------------------------

function weaknessScore(nFeitas, taxa, pesoIncidencia) {
  if (nFeitas < GATE_VOLUME) return null;
  const erro = 1 - taxa;
  const conf = Math.min(1, nFeitas / VOL_CONF);
  const incid = pesoIncidencia / INC_MAX;
  return erro * conf * incid * 100;
}

const ETICA_RE = /ética|estatuto.*oab|direitos.humanos|filosofia.do.direito/i;

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function chunkMinutos(total, maxSize) {
  if (total <= 0) return [];
  if (total <= maxSize) return [total];
  const n = Math.ceil(total / maxSize);
  const base = Math.floor(total / n);
  const resto = total - base * n;
  const chunks = [];
  for (let i = 0; i < n; i++) chunks.push(base + (i < resto ? 1 : 0));
  return chunks;
}

function gerarCronogramaInline(nos, hoje, dataProva, horasPorDia) {
  const budgetDiario = Math.round(horasPorDia * 60);
  const blocoSize = Math.max(5, Math.min(MAX_BLOCO_MIN, budgetDiario));

  // 1. Calendário
  const datas = [];
  const cur = new Date(hoje + "T00:00:00");
  const prova = new Date(dataProva + "T00:00:00");
  while (cur < prova) {
    datas.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  if (datas.length === 0) return [];

  const N = datas.length;
  const nSemanas = Math.max(1, Math.ceil(N / 7));
  const orcamentoTotalMin = Math.round(N * budgetDiario * FATOR_UTILIZACAO);

  // 2. Separa Ética
  const nosEtica = nos.filter((n) => ETICA_RE.test(n.nome));
  const nosRest  = nos.filter((n) => !ETICA_RE.test(n.nome));

  // 3. Piso Ética
  const pisoEticaMin = Math.max(
    Math.round(PISO_ETICA_FRACAO * orcamentoTotalMin),
    PISO_ETICA_SEMANAL_MIN * nSemanas
  );

  // 4. Pesos + minutos por nó
  const calcPeso = (n) => {
    const s = weaknessScore(n.nFeitas, n.taxa, n.pesoIncidencia);
    return s !== null ? s : n.pesoIncidencia;
  };
  const restante = Math.max(0, orcamentoTotalMin - pisoEticaMin);

  const comPesoRest = nosRest.map((n) => ({ n, peso: calcPeso(n) })).filter((x) => x.peso > 0 && x.n.pesoIncidencia > 0);
  const totalPesoRest = comPesoRest.reduce((s, x) => s + x.peso, 0);
  const minPorNo = new Map();
  if (totalPesoRest > 0) {
    for (const { n, peso } of comPesoRest) {
      const min = Math.round((peso / totalPesoRest) * restante);
      if (min > 0) minPorNo.set(n.id, { min, nome: n.nome, peso });
    }
  }

  const comPesoEtica = nosEtica.map((n) => ({ n, peso: calcPeso(n) }));
  const totalPesoEtica = comPesoEtica.reduce((s, x) => s + x.peso, 0);
  for (const { n, peso } of comPesoEtica) {
    const min = totalPesoEtica > 0
      ? Math.round((peso / totalPesoEtica) * pisoEticaMin)
      : Math.round(pisoEticaMin / Math.max(1, nosEtica.length));
    if (min > 0) minPorNo.set(n.id, { min, nome: n.nome, peso });
  }

  // 5. Expansão em filas (conteudo / questoes)
  const filas = [];
  for (const [id, { min, nome, peso }] of minPorNo) {
    const conteudoMin = Math.round(min * FRACAO_CONTEUDO);
    const questoesMin = min - conteudoMin;
    filas.push({
      id, nome, peso,
      conteudo: chunkMinutos(conteudoMin, blocoSize),
      questoes: chunkMinutos(questoesMin, blocoSize),
      ultimoConteudoDia: null,
    });
  }
  filas.sort((a, b) => b.peso - a.peso);

  // 6. Two-phase round-robin
  const usadoPorDia = new Map();
  const ordemPorDia = new Map();
  const blocos = [];

  const pushBloco = (data, id, nome, tipo, minutos) => {
    const ordem = ordemPorDia.get(data) ?? 0;
    blocos.push({ id, nome, data, tipo, minutos, ordem });
    ordemPorDia.set(data, ordem + 1);
    usadoPorDia.set(data, (usadoPorDia.get(data) ?? 0) + minutos);
  };

  const earliestFit = (dataMin, minutos) => {
    const startIdx = datas.findIndex((d) => d >= dataMin);
    if (startIdx === -1) return null;
    for (let i = startIdx; i < datas.length; i++) {
      const d = datas[i];
      if ((usadoPorDia.get(d) ?? 0) + minutos <= budgetDiario) return d;
    }
    return null;
  };

  const agendarFase = (tipo, getChunks, getDataMin, onPlace) => {
    const idx = new Map();
    let restantes = filas.reduce((s, f) => s + getChunks(f).length, 0);
    let guard = restantes * 4 + 100;
    while (restantes > 0 && guard-- > 0) {
      let progresso = false;
      for (const fila of filas) {
        const chunks = getChunks(fila);
        const i = idx.get(fila) ?? 0;
        if (i >= chunks.length) continue;
        const minutos = chunks[i];
        const data = earliestFit(getDataMin(fila), minutos);
        if (data) { pushBloco(data, fila.id, fila.nome, tipo, minutos); onPlace(fila, data); }
        idx.set(fila, i + 1);
        restantes--;
        progresso = true;
      }
      if (!progresso) break;
    }
  };

  agendarFase("conteudo", (f) => f.conteudo, () => hoje, (f, data) => {
    if (!f.ultimoConteudoDia || data > f.ultimoConteudoDia) f.ultimoConteudoDia = data;
  });
  agendarFase("questoes", (f) => f.questoes,
    (f) => (f.ultimoConteudoDia ? addDays(f.ultimoConteudoDia, 1) : hoje), () => {});

  return blocos;
}

// ---------------------------------------------------------------------------
// Auto-validação dos invariantes do BUG 1 (falha alto se houver drift)
// ---------------------------------------------------------------------------

function validarInvariantes(blocos, nos) {
  const erros = [];

  const ordenados = [...blocos].sort((a, b) =>
    a.data !== b.data ? a.data.localeCompare(b.data) : a.ordem - b.ordem
  );

  // (1) PRIORIDADE LIDERA: o primeiro bloco deve ser da matéria de maior peso.
  const pesoPorId = new Map();
  for (const n of nos) {
    const s = weaknessScore(n.nFeitas, n.taxa, n.pesoIncidencia);
    pesoPorId.set(n.id, s !== null ? s : n.pesoIncidencia);
  }
  const idsPresentes = new Set(blocos.map((b) => b.id));
  let maiorPesoId = null, maiorPeso = -Infinity;
  for (const id of idsPresentes) {
    const p = pesoPorId.get(id) ?? 0;
    if (p > maiorPeso) { maiorPeso = p; maiorPesoId = id; }
  }
  if (ordenados[0]?.id !== maiorPesoId) {
    erros.push(`primeiro bloco (${ordenados[0]?.nome}) NÃO é a matéria de maior prioridade (${nos.find((n) => n.id === maiorPesoId)?.nome})`);
  }

  // (2) primeiros blocos são CONTEÚDO
  if (ordenados[0]?.tipo !== "conteudo") {
    erros.push(`primeiro bloco é '${ordenados[0]?.tipo}', esperado 'conteudo'`);
  }

  // (3) CONTEÚDO ANTES DE QUESTÕES por matéria
  const porNo = new Map();
  for (const b of blocos) {
    const e = porNo.get(b.id) ?? { conteudo: [], questoes: [] };
    if (b.tipo === "conteudo") e.conteudo.push(b.data);
    if (b.tipo === "questoes") e.questoes.push(b.data);
    porNo.set(b.id, e);
  }
  for (const [id, { conteudo, questoes }] of porNo) {
    if (!conteudo.length || !questoes.length) continue;
    const ultimoC = conteudo.sort().at(-1);
    const primeiraQ = questoes.sort()[0];
    if (!(primeiraQ > ultimoC)) {
      const nome = nos.find((n) => n.id === id)?.nome ?? id;
      erros.push(`${nome}: questão (${primeiraQ}) não vem depois do conteúdo (${ultimoC})`);
    }
  }

  // (4) nenhum dia acima do budget
  const usado = new Map();
  for (const b of blocos) usado.set(b.data, (usado.get(b.data) ?? 0) + b.minutos);
  const budget = HORAS_DIA * 60;
  for (const [d, m] of usado) {
    if (m > budget) erros.push(`dia ${d} acima do budget: ${m} > ${budget}`);
  }

  return erros;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    console.log("=== SMOKE TEST — Cockpit de Estudo, Drop 1.5, Fatia 1 ===\n");

    // 1. Busca materias
    const { rows: materias } = await client.query(
      "SELECT id, nome, questoes_por_prova FROM materias ORDER BY nome"
    );
    console.log(`Materias encontradas: ${materias.length}`);

    // Cold-start (sem histórico) — espelha a Kamile começando
    const nos = materias.map((m) => ({
      id:             m.id,
      nome:           m.nome,
      pesoIncidencia: m.questoes_por_prova,
      nFeitas:        0,
      taxa:           0,
    }));

    // 2. Gera cronograma inline (two-phase)
    const blocosGerados = gerarCronogramaInline(nos, HOJE, DATA_PROVA, HORAS_DIA);
    console.log(`Blocos calculados: ${blocosGerados.length}`);

    // 3. AUTO-VALIDA invariantes ANTES de inserir
    const erros = validarInvariantes(blocosGerados, nos);
    if (erros.length > 0) {
      console.error("\n=== INVARIANTES VIOLADOS (BUG 1 não corrigido) ===");
      for (const e of erros) console.error(`  ✗ ${e}`);
      process.exit(1);
    }
    console.log("Invariantes OK: prioridade lidera + conteúdo antes de questões + budget respeitado.\n");

    // 4. Limpa blocos antigos (origem='gerado', pendentes, futuros)
    await client.query(
      `DELETE FROM cronograma_blocos
       WHERE user_id = $1 AND origem = 'gerado' AND status = 'pendente' AND data_alvo >= $2`,
      [KAMILE_ID, HOJE]
    );

    // 5. Insere em chunks
    if (blocosGerados.length > 0) {
      const CHUNK = 100;
      for (let start = 0; start < blocosGerados.length; start += CHUNK) {
        const chunk = blocosGerados.slice(start, start + CHUNK);
        const values = chunk.map((_, i) => {
          const base = i * 6;
          return `($${base + 1}, $${base + 2}::date, $${base + 3}::uuid, NULL, $${base + 4}::cronograma_tipo, $${base + 5}::integer, $${base + 6}::smallint, 'pendente'::bloco_status, 'gerado'::bloco_origem)`;
        }).join(", ");
        const params = chunk.flatMap((b) => [KAMILE_ID, b.data, b.id, b.tipo, b.minutos, b.ordem]);
        await client.query(
          `INSERT INTO cronograma_blocos
             (user_id, data_alvo, materia_id, subtema_id, tipo, minutos_alvo, ordem, status, origem)
           VALUES ${values}`,
          params
        );
      }
      console.log(`Inseridos ${blocosGerados.length} blocos.\n`);
    }

    // 6. Stats
    const { rows: statsRows } = await client.query(
      `SELECT COUNT(*) as total, SUM(minutos_alvo) as total_min,
              COUNT(*) FILTER (WHERE tipo='conteudo') as conteudo,
              COUNT(*) FILTER (WHERE tipo='questoes') as questoes,
              COUNT(DISTINCT data_alvo) as dias
       FROM cronograma_blocos WHERE user_id = $1 AND data_alvo >= $2`,
      [KAMILE_ID, HOJE]
    );
    const s = statsRows[0];
    console.log("=== CRONOGRAMA — RESULTADOS (via SQL) ===");
    console.log(`Total de blocos : ${s.total}`);
    console.log(`Total de minutos: ${s.total_min}`);
    console.log(`Conteudo        : ${s.conteudo}`);
    console.log(`Questoes        : ${s.questoes}`);
    console.log(`Dias com estudo : ${s.dias}`);
    console.log("");

    // 7. PRIMEIROS 8 blocos por (data_alvo, ordem) — verificação do BUG 1
    const { rows: primeiros } = await client.query(
      `SELECT cb.data_alvo, cb.ordem, m.nome, cb.tipo, cb.minutos_alvo
       FROM cronograma_blocos cb JOIN materias m ON m.id = cb.materia_id
       WHERE cb.user_id = $1 AND cb.data_alvo >= $2
       ORDER BY cb.data_alvo, cb.ordem LIMIT 8`,
      [KAMILE_ID, HOJE]
    );
    console.log("=== PRIMEIROS 8 BLOCOS (data_alvo, ordem) ===");
    for (const b of primeiros) {
      console.log(`  ${b.data_alvo} #${b.ordem}  ${b.nome.slice(0, 42).padEnd(42)} | ${b.tipo.padEnd(8)} | ${String(b.minutos_alvo).padStart(3)} min`);
    }
    console.log("");

    // 8. Confirma maior dia <= budget (via SQL)
    const { rows: maxDia } = await client.query(
      `SELECT data_alvo, SUM(minutos_alvo) as min FROM cronograma_blocos
       WHERE user_id = $1 AND data_alvo >= $2 GROUP BY data_alvo ORDER BY min DESC LIMIT 1`,
      [KAMILE_ID, HOJE]
    );
    console.log(`Dia mais cheio: ${maxDia[0]?.data_alvo} = ${maxDia[0]?.min} min (budget ${HORAS_DIA * 60})`);
    console.log("");

    // 9. estudo_sessoes — insere + lê
    const primeiraMateria = materias[0];
    const { rows: sessaoRows } = await client.query(
      `INSERT INTO estudo_sessoes (user_id, materia_id, tipo_estudo, duracao_min, anotacao)
       VALUES ($1, $2, 'leitura', 45, 'Smoke test — Drop 1.5, Fatia 1')
       RETURNING id, duracao_min, ts`,
      [KAMILE_ID, primeiraMateria.id]
    );
    const sessao = sessaoRows[0];
    console.log("=== ESTUDO_SESSOES — REGISTRO ===");
    console.log(`ID ${sessao.id} | ${primeiraMateria.nome.slice(0, 40)} | ${sessao.duracao_min} min`);
    const { rows: confirm } = await client.query(
      "SELECT duracao_min FROM estudo_sessoes WHERE id = $1", [sessao.id]
    );
    if (confirm.length === 1 && confirm[0].duracao_min === 45) {
      console.log("Leitura confirmada: estudo_sessoes OK");
    } else {
      console.error("ERRO: leitura de volta falhou"); process.exit(1);
    }
    await client.query("DELETE FROM estudo_sessoes WHERE id = $1", [sessao.id]);
    console.log("Registro de smoke removido.");
    console.log("\n=== SMOKE PASS ===");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("ERRO:", err.message);
  process.exit(1);
});
