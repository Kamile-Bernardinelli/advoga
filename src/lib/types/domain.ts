// Tipos de domínio da aplicação (independentes dos tipos gerados do DB)
// Usados pela lógica de negócio: planner, weakness-score, correcao

export interface NoDiagnostico {
  noId: string;
  noNome: string;
  eixo: string;
  nFeitas: number;
  nAcertos: number;
  taxa: number;
  pesoIncidencia: number;
  volumeOk: boolean;
  /** Drop 2.5: nó pertence ao bloco de Ética (≥15% do edital). Em subtemas é
   *  setado pela action via matéria-pai (o nome do subtema não casa ETICA_RE).
   *  Opcional → backward-compat: matéria-level continua caindo no ETICA_RE por nome. */
  eEtica?: boolean;
}

export interface Questao {
  id: string;
  enunciado: string;
  alternativaA: string;
  alternativaB: string;
  alternativaC: string;
  alternativaD: string;
  materiaId: string;
  subtemaId: string | null;
  microTopicoId: string | null;
  // gabarito AUSENTE intencionalmente — apenas disponível pós-finalize
}

export interface QuestaoComGabarito extends Questao {
  gabarito: "A" | "B" | "C" | "D";
}

export interface Resposta {
  sessaoId: string;
  questaoId: string;
  respostaDada: "A" | "B" | "C" | "D" | null;
  correta: boolean | null; // null antes do finalize
  tempoSeg: number | null;
}

export interface Diagnostico {
  userId: string;
  nos: NoDiagnostico[];
  geradoEm: string;
}

export interface ItemPlano {
  materia: string;
  subtema?: string;
  dimensao?: string;
  n: number;
  motivo: "reforco" | "medir" | "etica" | "espacado";
}

export interface PlanoDiario {
  data: string;
  horas: number;
  questoesAlvo: number;
  distribuicao: ItemPlano[];
  geradoEm: string;
}

// ============================================================
// Cockpit de Estudo (Drop 1.5) — APPEND
// ============================================================

/** Tipo de atividade de estudo (espelha enum `tipo_estudo` do DB). */
export type TipoEstudo =
  | "leitura"
  | "video"
  | "resumo"
  | "revisao"
  | "questoes"
  | "outro";

/** Status de um bloco no roteiro (espelha enum `bloco_status` do DB). */
export type BlocoStatus = "pendente" | "em_andamento" | "feito";

/** Origem de um bloco de cronograma (espelha enum `bloco_origem` do DB). */
export type BlocoOrigem = "gerado" | "manual";

/** Tipo de um bloco de cronograma (espelha enum `cronograma_tipo` do DB). */
export type CronogramaTipo = "conteudo" | "questoes" | "revisao";

/** Registro de uma sessão de estudo (SENSOR — 1 linha = 1 evento). */
export interface EstudoSessao {
  id: string;
  userId: string;
  materiaId: string;
  subtemaId: string | null;
  microTopicoId: string | null;
  materialId: string | null;
  local: string | null;
  tipoEstudo: TipoEstudo;
  inicio: string | null;   // ISO timestamp (Fatia 2 — timer)
  fim: string | null;      // ISO timestamp (Fatia 2 — timer)
  duracaoMin: number;      // canônico (NOT NULL, > 0)
  anotacao: string | null;
  ts: string;              // quando o evento ocorreu
  createdAt: string;
  updatedAt: string;
  // campos join (display)
  materiaNome?: string;
  subtemaNome?: string;
}

/** Bloco de estudo no calendário (ROTEIRO). */
export interface CronogramaBloco {
  id: string;
  userId: string;
  dataAlvo: string;        // ISO YYYY-MM-DD
  materiaId: string;
  subtemaId: string | null;
  tipo: CronogramaTipo;
  minutosAlvo: number;
  status: BlocoStatus;
  ordem: number;
  origem: BlocoOrigem;
  createdAt: string;
  updatedAt: string;
  // campos join (display)
  materiaNome?: string;
  subtemaNome?: string;
}

// ============================================================
// Cockpit de Estudo v2 — LOOP DE ADERÊNCIA (Drop 1.5 v2) — APPEND
// ============================================================

/** Config de metas da usuária (espelha public.metas_estudo). Singleton por user. */
export interface MetasEstudo {
  id: string;
  userId: string;
  metaBaseDiariaMin: number;      // default 180
  metaMensalMin: number | null;   // null = sem meta mensal
  diasEstudo: number[];            // [0..6] subset — 0=Dom..6=Sáb (= JS getDay)
  timezone: string;                // default 'America/Sao_Paulo'
  createdAt: string;
  updatedAt: string;
}

/** Override de meta para um dia específico (espelha public.metas_diarias). */
export interface MetaDiaria {
  id: string;
  userId: string;
  data: string;          // YYYY-MM-DD
  minutosMeta: number;   // 0 = folga explícita
  nota: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Saldo de um dia específico (espelha v_saldo_diario — fatos do DB). */
export interface SaldoDia {
  dia: string;           // YYYY-MM-DD
  metaMin: number;       // meta_do_dia() para esse dia
  realMin: number;       // Σ duracao_min das sessões do dia
  nSessoes: number;
  saldoDia: number;      // real − meta (+ = superávit, − = déficit)
  saldoAcumSemana: number;
  saldoAcumMes: number;
  saldoAcumTotal: number;
}

/** Saldo mensal (espelha v_saldo_mensal — fato do DB, o "contrato"). */
export interface SaldoMes {
  mes: string;              // YYYY-MM-DD (1º do mês)
  metaMensalMin: number | null;
  realMin: number;
  nSessoes: number;
  saldoMes: number;         // real − meta mensal
  pctMeta: number | null;   // null se sem meta mensal
}

/** Aderência de hoje — fatos (DB) + recomendações (saldo.ts). */
export interface AderenciaHoje {
  // Fatos (das views)
  metaHojeMin: number;
  realHojeMin: number;
  saldoHojeMin: number;
  saldoAcumMesMin: number;
  realMesMin: number;
  metaMensalMin: number | null;
  // Recomendações (saldo.ts — testável)
  diasRestantesMes: number;
  ritmoNecessarioMin: number;
  status: "adiantada" | "no_ritmo" | "atrasada";
}

// ============================================================
// Catálogo de Materiais (Fatia B) — APPEND
// ============================================================

/** Tipo de material de estudo (espelha enum `material_tipo` do DB). */
export type MaterialTipo =
  | "livro"
  | "pdf"
  | "video"
  | "curso"
  | "lei"
  | "resumo"
  | "outro";

/** Material de estudo da usuária (espelha public.materiais). */
export interface Material {
  id: string;
  userId: string;
  nome: string;
  tipo: MaterialTipo;
  referencia: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Item de tempo por nó de conteúdo (espelha v_tempo_por_no). */
export interface TempoPorNo {
  userId: string;
  eixo: "materia" | "subtema" | "micro";
  noId: string;
  noNome: string;
  totalMin: number;
  nSessoes: number;
  ultimoTs: string;
}

// ============================================================
// Incidência & Tendência por subtema (painel descritivo /incidencia) — APPEND (Drop 4)
// Fato do corpus (views SEM user_id, aggregate-safe). NENHUM juízo preditivo.
// ============================================================

/** Linha crua de v_incidencia_subtema (cumulativa, fato do corpus). */
export interface IncidenciaRow {
  subtema_id: string | null;
  subtema_nome: string | null;
  materia_id: string | null;
  materia_nome: string | null;
  n_questoes: number | null;
  n_disponiveis: number | null;
}

/** Linha crua de v_tendencia_subtema (1 por subtema×edição, só células não-zero). */
export interface TendenciaRow {
  subtema_id: string | null;
  exame_numero: number | null;
  ano: number | null;
  n_questoes: number | null;
}

/** View-model de uma linha do ranking, com série temporal JÁ densificada. */
export interface SubtemaTendencia {
  subtemaId: string;
  subtemaNome: string;
  materiaNome: string;
  incidencia: number;   // n_questoes cumulativo (a métrica do ranking)
  disponiveis: number;  // n_disponiveis (respondíveis agora)
  serie: number[];      // alinhada a `edicoes`, com zeros reintroduzidos
}
