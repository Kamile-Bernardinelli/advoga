// Planner v1 — lógica PURA (testável sem DB).
// Entrada: horas disponíveis + nós de diagnóstico.
// Saída: PlanoDiario com distribuição de questões por nó.
import type { NoDiagnostico, ItemPlano, PlanoDiario } from "@/lib/types/domain";
import { weaknessScore } from "@/lib/diagnostico/weakness-score";
import {
  velocidadeQhDefault,
  pisoEticaDiario,
  gateVolume,
  incidenciaMax,
  volumeConfiancaPlena,
} from "./config";

const ÉTICA_CHAVE = "ética"; // nome da matéria (case-insensitive match)

/**
 * Boost de repetição espaçada: matérias erradas recentemente.
 * Fornecido pela camada de dados (query de respostas das últimas N sessões).
 */
export interface SubtemaBoost {
  /** no_id da matéria ou subtema */
  noId: string;
  /** Multiplicador de peso (ex.: 1.2 = +20%) */
  multiplicador: number;
}

export interface PlannerInput {
  horas: number;
  nos: NoDiagnostico[];
  /** Data do plano (ISO string YYYY-MM-DD) */
  data: string;
  /** Velocidade customizada (sobrescreve velocidadeQhDefault) */
  qph?: number;
  /**
   * Boosts de repetição espaçada (matérias/subtemas errados recentemente).
   * Aplicados sobre o score ponderado — AC-1.6.5.
   */
  subtemaBoosts?: SubtemaBoost[];
}

/**
 * Gera o plano diário de estudos.
 *
 * Algoritmo:
 * 1. questoesAlvo = horas × qph
 * 2. Separa Ética → garante piso fixo (AC-1.6.4)
 * 3. Nós com volume_ok → "reforço" (prioridade = incidência × weaknessScore × boost_espaçado)
 * 4. Nós sem volume_ok → "medir" (amostragem — aparece como bônus se sobrar cota — AC-1.6.3)
 * 5. Distribui proporcionalmente pelo score normalizado
 * 6. Injeta piso de Ética; se Ética tiver weakness_score > piso, aumenta proporcionalmente
 * 7. Aplica boost de repetição espaçada sobre matérias recém-erradas (AC-1.6.5)
 */
export function gerarPlano(input: PlannerInput): PlanoDiario {
  const qph = input.qph ?? velocidadeQhDefault;
  const questoesAlvo = Math.round(input.horas * qph);

  const cfg = { gateVolume, volumeConfiancaPlena, incidenciaMax };

  // Mapa de boosts para lookup rápido (AC-1.6.5)
  const boostMap = new Map<string, number>(
    (input.subtemaBoosts ?? []).map((b) => [b.noId, b.multiplicador])
  );

  // Separa Ética dos demais
  const nosEtica = input.nos.filter((n) =>
    n.noNome.toLowerCase().includes(ÉTICA_CHAVE)
  );
  const nosRest = input.nos.filter(
    (n) => !n.noNome.toLowerCase().includes(ÉTICA_CHAVE)
  );

  // Piso de Ética: 10% do total (AC-1.6.4)
  let pisoEtica = Math.max(
    pisoEticaDiario,
    Math.round(questoesAlvo * 0.1)
  );

  // Se Ética tiver volume_ok e weakness_score alto, aumenta cota proporcionalmente (AC-1.6.4)
  const nosEticaComScore = nosEtica
    .map((no) => ({ no, score: weaknessScore(no, cfg) }))
    .filter((x): x is { no: NoDiagnostico; score: number } => x.score !== null);

  if (nosEticaComScore.length > 0) {
    // Quanto do total de questões a Ética "mereceria" pelo weakness_score?
    // Usa peso relativo de Ética dentro do total de scores
    const scoreEtica = nosEticaComScore[0].score;
    // Bonus de Ética: se score > baseline, amplia cota (cap em 20% do total)
    const etcaCotaBonus = Math.round(scoreEtica * questoesAlvo / 100);
    pisoEtica = Math.max(pisoEtica, etcaCotaBonus);
  }

  pisoEtica = Math.min(pisoEtica, Math.round(questoesAlvo * 0.3)); // cap: 30% do dia
  const cota = questoesAlvo - pisoEtica;

  // Nós com volume suficiente → score de reforço + boost espaçado
  const comScore = nosRest
    .map((no) => {
      const baseScore = weaknessScore(no, cfg);
      if (baseScore === null) return { no, score: null as null };
      const boost = boostMap.get(no.noId) ?? 1.0;
      return { no, score: baseScore * boost };
    })
    .filter((x): x is { no: NoDiagnostico; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score);

  // Nós sem volume → medir (incidência pura — sem weakness penalizando — AC-1.6.3)
  const semVolume = nosRest.filter((no) => no.nFeitas < gateVolume);

  // Distribui cota proporcional aos scores
  const totalScore = comScore.reduce((s, x) => s + x.score, 0);
  const distribuicao: ItemPlano[] = [];

  if (totalScore > 0 && comScore.length > 0) {
    for (const { no, score } of comScore) {
      const n = Math.round((score / totalScore) * cota);
      if (n > 0) {
        const temBoost = (boostMap.get(no.noId) ?? 1.0) > 1.0;
        distribuicao.push({
          materia: no.noNome,
          n,
          motivo: temBoost ? "espacado" : "reforco",
        });
      }
    }
  }

  // Piso de Ética (AC-1.6.4 — sempre presente)
  if (nosEtica.length > 0) {
    distribuicao.push({
      materia: nosEtica[0].noNome,
      n: pisoEtica,
      motivo: "etica",
    });
  } else {
    // Sem dados de Ética no diagnóstico: injeta dose mínima de qualquer forma
    distribuicao.push({
      materia: "Ética e Estatuto da OAB",
      n: pisoEtica,
      motivo: "etica",
    });
  }

  // Amostragem (medir) — se sobrar cota, adiciona matérias sem volume suficiente
  // Ponderadas por incidência pura (sem weakness — AC-1.6.3)
  const usado = distribuicao.reduce((s, i) => s + i.n, 0);
  const sobraCota = questoesAlvo - usado;
  if (sobraCota > 0 && semVolume.length > 0) {
    // Ordena por incidência (maior primeiro)
    const semVolumeOrdenado = [...semVolume].sort(
      (a, b) => b.pesoIncidencia - a.pesoIncidencia
    );
    const totalIncidencia = semVolumeOrdenado.reduce(
      (s, n) => s + n.pesoIncidencia,
      0
    );
    for (const no of semVolumeOrdenado) {
      if (totalIncidencia === 0) break;
      const n = Math.round((no.pesoIncidencia / totalIncidencia) * sobraCota);
      if (n > 0) {
        distribuicao.push({ materia: no.noNome, n, motivo: "medir" });
      }
    }
  }

  return {
    data: input.data,
    horas: input.horas,
    questoesAlvo,
    distribuicao,
    geradoEm: new Date().toISOString(),
  };
}
