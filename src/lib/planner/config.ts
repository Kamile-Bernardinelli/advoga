// Defaults calibráveis do planner (sem migration — só alterar este arquivo).
// Espelham os valores nas views SQL:
//   gateVolume → diag_gate_minimo() no Postgres
//   velocidadeQhDefault → §13.5 do brief (ajuste pós-calibração)

/** Gate de volume mínimo para declarar fraqueza e alocar como "reforço". */
export const gateVolume = 8;

/** Questões por hora — velocidade de estudo padrão da Kamile. Calibrável §13.5. */
export const velocidadeQhDefault = 30;

/** Piso diário de questões de Ética (ROI alto, conteúdo fechado). */
export const pisoEticaDiario = 8;

/** Janelas de repetição espaçada em dias (erros recentes reaparecem). */
export const janelasEspacamento = [1, 3, 7] as const;

/** Máxima incidência (questoes_por_prova) para normalizar o peso. */
export const incidenciaMax = 20;

/** Volume a partir do qual a confiança do score é 1.0. */
export const volumeConfiancaPlena = 30;

// --- Cronograma de Estudo (Drop 1.5) --- APPEND — não alterar as constantes acima
/** Data da prova OAB 1ª fase (restrição-mãe). */
export const dataProva = "2026-09-06";

/** Horas/dia de estudo padrão quando não informado pelo usuário. */
export const minutosPorDiaDefault = 180; // 3 h

/** Fração do tempo de cada nó dedicada a LEITURA DE CONTEÚDO (o restante = questões). */
export const fracaoConteudo = 0.6;

/** Fração mínima do orçamento total reservada para Ética/CED/DH/Filosofia (regra ≥15% do edital). */
export const pisoEticaFracao = 0.15;

/** Mínimo semanal de minutos de Ética (calibrador de semanas curtas). */
export const pisoEticaSemanalMin = 90;

/** Duração dos blocos de revisão espaçada para matérias com erros recentes (min). */
export const revisaoMin = 20;

/** Tamanho máximo de um bloco de estudo (min). Os minutos de cada nó são fatiados
 *  em blocos desse tamanho para sequenciar por prioridade no calendário (capado ao
 *  budget diário). Sem isto, um nó grande viraria 1 bloco gigante que estoura o dia. */
export const maxBlocoMin = 60;

/** Espelha public.esforco_gate_tempo_min() — limiar anti-chute de esforço (min). */
export const gateTempoMin = 60;

// --- Loop de Aderência (Drop 1.5 v2) --- APPEND — não alterar as constantes acima

/** Meta base diária padrão (min). Espelha DEFAULT de metas_estudo.meta_base_diaria_min. */
export const metaBaseDiariaDefaultMin = 180; // 3h

/** Fator de teto de compensação: máximo de minutos permitidos por dia = metaBase × fator. */
export const fatorTetoCompensacao = 1.5;

/** Teto absoluto de compensação diária (min). Usado como cap máximo de override proposto. */
export const minutosTetoCompensacao = Math.round(metaBaseDiariaDefaultMin * fatorTetoCompensacao); // 270 min

// --- Esforço × Resultado (Drop 2) --- APPEND — não alterar as constantes acima
/** Taxa de acerto a partir da qual o resultado é "bom" (margem acima da nota de corte OAB 50%). Calibrável. */
export const taxaBoaEsforco = 0.6;
/** Minutos a partir dos quais o esforço é "alto" (2× o gate de tempo de 60min). Calibrável. */
export const tempoAltoEsforcoMin = 120;
