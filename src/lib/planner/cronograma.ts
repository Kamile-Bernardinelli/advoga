// Gerador de cronograma de estudo — PURO, testável sem DB.
//
// IDS: REUSE de ranquearNos (weakness-score.ts) e constantes de config.ts.
//      Não modifica nenhum arquivo existente — só importa.
//
// Saída: CronogramaBlocoGerado[] → persistido em cronograma_blocos pela Server Action.
//
// Algoritmo (§3.2 do study-cockpit.md):
//   1. Calendário (N dias, budget total de minutos)
//   2. Prioridade por nó: weaknessScore (gate ≥8) ou incidência pura (cold-start)
//   3. Dose garantida de Ética (≥15% do edital)
//   4. Alocação proporcional de minutos por nó
//   5. EXPANSÃO: minutos de cada nó FATIADOS em blocos de dia (conteúdo 60% / questões 40%);
//      revisão espaçada p/ erros recentes
//   6. SEQUENCIAMENTO por PRIORIDADE: round-robin (maior incidência×fraqueza nos
//      PRIMEIROS dias); conteúdo SEMPRE antes de questões da mesma matéria
//      (questões ≥1 dia após a última leitura daquele nó).

import type { NoDiagnostico, CronogramaTipo } from "@/lib/types/domain";
import { ranquearNos } from "@/lib/diagnostico/weakness-score";
import type { SubtemaBoost } from "@/lib/planner/planner";
import {
  gateVolume,
  volumeConfiancaPlena,
  incidenciaMax,
  janelasEspacamento,
  // Cronograma-specific (Drop 1.5):
  fracaoConteudo as defaultFracaoConteudo,
  pisoEticaFracao as defaultPisoEticaFracao,
  pisoEticaSemanalMin as defaultPisoEticaSemanalMin,
  revisaoMin as defaultRevisaoMin,
  maxBlocoMin as defaultMaxBlocoMin,
} from "./config";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Bloco intermediário — saída do algoritmo puro (sem UUIDs do DB). */
export interface CronogramaBlocoGerado {
  dataAlvo: string;       // ISO YYYY-MM-DD
  noId: string;           // UUID do nó (materia ou subtema)
  eixo: string;           // 'materia' | 'subtema'
  tipo: CronogramaTipo;
  minutosAlvo: number;
  ordem: number;          // posição dentro do dia (0-based; reflete prioridade)
}

/** Parâmetros de calibração do gerador (usam defaults de config.ts). */
export interface CronogramaConfig {
  pisoEticaFracao: number;      // default 0.15
  pisoEticaSemanalMin: number;  // default 90
  fracaoConteudo: number;       // default 0.6
  revisaoMin: number;           // default 20 min
  maxBlocoMin: number;          // default 60 min — tamanho máx. de cada bloco
}

/** Input do gerador puro. */
export interface CronogramaInput {
  hoje: string;                  // ISO YYYY-MM-DD
  dataProva: string;             // '2026-09-06'
  horasPorDia: number;
  /** Weekdays a estudar: 0=Dom…6=Sáb. Default: todos os dias. */
  diasEstudo?: number[];
  /**
   * NOVO (opcional, aditivo — §4.2/4.3 do spec v2): orçamento em minutos de um
   * dia específico. Quando presente, dimensiona CADA dia pela sua meta real
   * (base + override). Espelha meta_do_dia() do Postgres.
   * Fallback: quando ausente, usa budgetDiario (horasPorDia × 60) para TODO dia.
   */
  metaPorDiaMin?: (dataISO: string) => number;
  /** Universo de nós do diagnóstico (merged com catálogo pelo cold-start na action). */
  nos: NoDiagnostico[];
  /** Nós com erros recentes — recebem blocos de revisão espaçada. */
  recentErros?: SubtemaBoost[];
  cfg?: Partial<CronogramaConfig>;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Regex para identificar matérias de Ética/CED/DH/Filosofia (padrão da casa de planner.ts). */
const ETICA_RE = /ética|estatuto.*oab|direitos.humanos|filosofia.do.direito/i;

/** Drop 2.5: a action usa isto sobre o NOME DA MATÉRIA-PAI p/ marcar subtemas de Ética. */
export function nomeEhEtica(nome: string): boolean {
  return ETICA_RE.test(nome);
}

/** Soma days a uma data ISO e devolve nova data ISO. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fatia um total de minutos em pedaços de no máximo `maxSize`.
 * Preserva a soma exata; distribui o resto nos primeiros pedaços.
 * Ex.: chunkMinutos(150, 60) → [60, 45, 45]   (soma 150, cada ≤ 60)
 */
function chunkMinutos(total: number, maxSize: number): number[] {
  if (total <= 0) return [];
  if (total <= maxSize) return [total];
  const n = Math.ceil(total / maxSize);
  const base = Math.floor(total / n);
  const resto = total - base * n;
  const chunks: number[] = [];
  for (let i = 0; i < n; i++) chunks.push(base + (i < resto ? 1 : 0));
  return chunks;
}

/** Fila de blocos de um nó: chunks de conteúdo e de questões, separados por fase. */
interface FilaNo {
  noId: string;
  eixo: string;
  peso: number;                  // prioridade (maior = mais cedo no calendário)
  conteudo: number[];            // tamanhos (min) dos blocos de conteúdo
  questoes: number[];            // tamanhos (min) dos blocos de questões
  ultimoConteudoDia: string | null; // gate "questões ≥1 dia após a última leitura"
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Gera o cronograma de estudo de hoje até a data da prova.
 *
 * É uma função pura: sem efeitos colaterais, sem DB, sem I/O.
 * Testável isoladamente (ver tests/unit/cronograma.test.ts).
 */
export function gerarCronograma(input: CronogramaInput): CronogramaBlocoGerado[] {
  const cfg: CronogramaConfig = {
    pisoEticaFracao: defaultPisoEticaFracao,
    pisoEticaSemanalMin: defaultPisoEticaSemanalMin,
    fracaoConteudo: defaultFracaoConteudo,
    revisaoMin: defaultRevisaoMin,
    maxBlocoMin: defaultMaxBlocoMin,
    ...input.cfg,
  };

  const wcfg = { gateVolume, volumeConfiancaPlena, incidenciaMax };
  const diasEstudo = input.diasEstudo ?? [0, 1, 2, 3, 4, 5, 6];

  // §4.3 ponto 1: scalar é fallback; budgetDoDia é o orçamento REAL de cada dia.
  const budgetDiario = Math.max(1, Math.round(input.horasPorDia * 60));
  const budgetDoDia = (data: string): number =>
    input.metaPorDiaMin
      ? Math.max(0, Math.round(input.metaPorDiaMin(data)))
      : budgetDiario;
  // blocoSize é calculado após construir o calendário (depende de maxBudget por dia).

  // -------------------------------------------------------------------------
  // 1. CALENDÁRIO — N dias de estudo disponíveis
  // -------------------------------------------------------------------------
  const datas: string[] = [];
  const cur = new Date(input.hoje + "T00:00:00");
  const prova = new Date(input.dataProva + "T00:00:00");

  while (cur < prova) {
    const d = cur.toISOString().slice(0, 10);
    // §4.3 ponto 2: inclui dia só se houver orçamento (override=0 e folga somem de graça)
    if (diasEstudo.includes(cur.getDay()) && budgetDoDia(d) > 0) {
      datas.push(d);
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (datas.length === 0) return [];

  const N = datas.length;
  const nSemanas = Math.max(1, Math.ceil(N / 7));
  // Agenda ~90% da capacidade: deixa folga diária para descanso/atraso e absorve a
  // fragmentação do empacotamento (sem isto, qualquer sobra estouraria o último dia).
  const FATOR_UTILIZACAO = 0.9;
  // §4.3 ponto 3: orçamento total = soma dos orçamentos diários (não N × escalar)
  const orcamentoTotalMin = Math.round(
    datas.reduce((s, d) => s + budgetDoDia(d), 0) * FATOR_UTILIZACAO
  );
  // blocoSize: cap pelo MAIOR dia (chunk cabe no maior; earliestFit pula dias menores)
  const maxBudget = N > 0 ? Math.max(...datas.map(budgetDoDia)) : budgetDiario;
  const blocoSize = Math.max(5, Math.min(cfg.maxBlocoMin, maxBudget));

  // -------------------------------------------------------------------------
  // 2. SEPARAR ÉTICA DOS DEMAIS
  //    Drop 2.5: flag explícita (subtema) com fallback p/ nome (matéria), backward-compat.
  // -------------------------------------------------------------------------
  const isEtica = (n: NoDiagnostico): boolean => n.eEtica ?? ETICA_RE.test(n.noNome);
  const nosEtica = input.nos.filter(isEtica);
  const nosRest  = input.nos.filter((n) => !isEtica(n));

  // -------------------------------------------------------------------------
  // 3. DOSE GARANTIDA DE ÉTICA (regra ≥15% do edital — Ética/CED/DH/Filosofia)
  // -------------------------------------------------------------------------
  const pisoEticaMin = Math.max(
    Math.round(cfg.pisoEticaFracao * orcamentoTotalMin),
    cfg.pisoEticaSemanalMin * nSemanas
  );

  // -------------------------------------------------------------------------
  // 4. ALOCAÇÃO PROPORCIONAL de minutos por nó
  //    Peso: weaknessScore quando amostra suficiente; incidência pura se cold-start.
  // -------------------------------------------------------------------------
  const restante = Math.max(0, orcamentoTotalMin - pisoEticaMin);

  const rankedRest = ranquearNos(nosRest, wcfg);
  const nosComPeso = rankedRest
    .map(({ no, score }) => ({
      no,
      peso: score !== null ? score : no.pesoIncidencia, // cold-start: incidência pura
    }))
    .filter((x) => x.peso > 0 && x.no.pesoIncidencia > 0);

  const totalPesoRest = nosComPeso.reduce((s, x) => s + x.peso, 0);

  const minutosPorNo = new Map<string, number>();
  if (totalPesoRest > 0) {
    for (const { no, peso } of nosComPeso) {
      const min = Math.round((peso / totalPesoRest) * restante);
      if (min > 0) minutosPorNo.set(no.noId, min);
    }
  }

  const rankedEtica = ranquearNos(nosEtica, wcfg);
  const nosEticaComPeso = rankedEtica.map(({ no, score }) => ({
    no,
    peso: score !== null ? score : Math.max(1, no.pesoIncidencia),
  }));

  const minutosEtica = new Map<string, number>();
  if (nosEtica.length > 0) {
    const totalPesoEtica = nosEticaComPeso.reduce((s, x) => s + x.peso, 0);
    for (const { no, peso } of nosEticaComPeso) {
      const min = totalPesoEtica > 0
        ? Math.round((peso / totalPesoEtica) * pisoEticaMin)
        : Math.round(pisoEticaMin / nosEtica.length);
      if (min > 0) minutosEtica.set(no.noId, min);
    }
  }

  // -------------------------------------------------------------------------
  // 5. EXPANSÃO EM BLOCOS — fatia minutos de cada nó em blocos de dia.
  //    chunks = [conteúdo… , questões…]  (conteúdo sempre na frente da fila)
  // -------------------------------------------------------------------------
  const filas: FilaNo[] = [];

  const addFila = (noId: string, eixo: string, peso: number, minutos: number) => {
    const conteudoMin = Math.round(minutos * cfg.fracaoConteudo);
    const questoesMin = minutos - conteudoMin;
    const conteudo = chunkMinutos(conteudoMin, blocoSize);
    const questoes = chunkMinutos(questoesMin, blocoSize);
    if (conteudo.length === 0 && questoes.length === 0) return;
    filas.push({ noId, eixo, peso, conteudo, questoes, ultimoConteudoDia: null });
  };

  for (const { no, peso } of nosComPeso) {
    const m = minutosPorNo.get(no.noId);
    if (m) addFila(no.noId, no.eixo, peso, m);
  }
  for (const { no, peso } of nosEticaComPeso) {
    const m = minutosEtica.get(no.noId);
    if (m) addFila(no.noId, no.eixo, peso, m);
  }

  // Ordena filas por PRIORIDADE (maior peso primeiro → mais cedo no calendário).
  filas.sort((a, b) => b.peso - a.peso);

  // -------------------------------------------------------------------------
  // 6. SEQUENCIAMENTO POR PRIORIDADE — DUAS FASES (conteúdo → questões)
  //    Cada fase é um round-robin por prioridade: o nó de maior peso pega o
  //    primeiro slot do dia mais cedo. Conteúdo é totalmente colocado antes de
  //    qualquer questão (garante "conteúdo antes de questões" por matéria) e a
  //    questão de cada nó ainda respeita ≥1 dia após a última leitura DELE.
  // -------------------------------------------------------------------------
  const usadoPorDia  = new Map<string, number>();
  const ordemPorDia  = new Map<string, number>();
  const blocos: CronogramaBlocoGerado[] = [];

  const pushBloco = (
    data: string, noId: string, eixo: string,
    tipo: CronogramaTipo, minutos: number
  ) => {
    const ordem = ordemPorDia.get(data) ?? 0;
    blocos.push({ dataAlvo: data, noId, eixo, tipo, minutosAlvo: minutos, ordem });
    ordemPorDia.set(data, ordem + 1);
    usadoPorDia.set(data, (usadoPorDia.get(data) ?? 0) + minutos);
  };

  /** Primeiro dia >= dataMin com espaço para `minutos`. null se não houver. */
  const earliestFit = (dataMin: string, minutos: number): string | null => {
    const startIdx = datas.findIndex((d) => d >= dataMin);
    if (startIdx === -1) return null;
    for (let i = startIdx; i < datas.length; i++) {
      const d = datas[i];
      // §4.3 ponto 4: usa o orçamento REAL daquele dia (não o escalar global)
      if ((usadoPorDia.get(d) ?? 0) + minutos <= budgetDoDia(d)) return d;
    }
    return null;
  };

  /**
   * Round-robin de uma fase: percorre as filas em ordem de prioridade e coloca
   * 1 chunk por fila por rodada, no dia mais cedo disponível (>= dataMin do nó).
   */
  const agendarFase = (
    tipo: "conteudo" | "questoes",
    getChunks: (f: FilaNo) => number[],
    getDataMin: (f: FilaNo) => string,
    onPlace: (f: FilaNo, data: string) => void
  ) => {
    const idx = new Map<FilaNo, number>();
    let restantes = filas.reduce((s, f) => s + getChunks(f).length, 0);
    let guard = restantes * 4 + 100; // safety contra loop infinito

    while (restantes > 0 && guard-- > 0) {
      let progresso = false;
      for (const fila of filas) {                 // ← ordem de PRIORIDADE
        const chunks = getChunks(fila);
        const i = idx.get(fila) ?? 0;
        if (i >= chunks.length) continue;

        const minutos = chunks[i];
        const dataMin = getDataMin(fila);
        // Sem espaço dentro do horizonte → DESCARTA o chunk (nunca estoura o budget
        // de um dia). Como agendamos só 90% da capacidade, o descarte é raro/zero.
        const data = earliestFit(dataMin, minutos);

        if (data) {
          pushBloco(data, fila.noId, fila.eixo, tipo, minutos);
          onPlace(fila, data);
        }
        idx.set(fila, i + 1);
        restantes--;
        progresso = true;
      }
      if (!progresso) break;
    }
  };

  // FASE 1 — CONTEÚDO (leitura lidera; registra a última leitura de cada nó)
  agendarFase(
    "conteudo",
    (f) => f.conteudo,
    () => input.hoje,
    (f, data) => {
      if (!f.ultimoConteudoDia || data > f.ultimoConteudoDia) f.ultimoConteudoDia = data;
    }
  );

  // FASE 2 — QUESTÕES (≥1 dia após a última leitura DAQUELE nó)
  agendarFase(
    "questoes",
    (f) => f.questoes,
    (f) => (f.ultimoConteudoDia ? addDays(f.ultimoConteudoDia, 1) : input.hoje),
    () => {}
  );

  // -------------------------------------------------------------------------
  // 7. REVISÃO ESPAÇADA — janelas [1,3,7] dias p/ nós com erros recentes
  // -------------------------------------------------------------------------
  const recentErrosSet = new Set((input.recentErros ?? []).map((b) => b.noId));
  for (const fila of filas) {
    if (!recentErrosSet.has(fila.noId)) continue;
    for (const offset of janelasEspacamento) {
      const dataMin = addDays(input.hoje, offset);
      if (dataMin >= input.dataProva) continue;
      // Descarta se não couber (mantém o invariante: nenhum dia acima do budget).
      const data = earliestFit(dataMin, cfg.revisaoMin);
      if (data) pushBloco(data, fila.noId, fila.eixo, "revisao", cfg.revisaoMin);
    }
  }

  return blocos;
}
