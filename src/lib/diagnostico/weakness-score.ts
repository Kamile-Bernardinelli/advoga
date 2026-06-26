// Motor de fraqueza — PURO, testável sem DB.
// Alinha-se com o gate da view (volume_ok >= 8) e o config do planner.
import type { NoDiagnostico } from "@/lib/types/domain";

export interface WeaknessConfig {
  /** Gate de volume mínimo de respostas para declarar fraqueza. Default: 8 */
  gateVolume: number;
  /** Volume a partir do qual a confiança é máxima (1.0). Default: 30 */
  volumeConfiancaPlena: number;
  /** Máxima incidência possível (questoes_por_prova da matéria mais pesada). Default: 20 */
  incidenciaMax: number;
}

export const DEFAULTS: WeaknessConfig = {
  gateVolume: 8,
  volumeConfiancaPlena: 30,
  incidenciaMax: 20,
};

/**
 * Calcula o score de fraqueza de um nó do diagnóstico.
 * Retorna null se o volume está abaixo do gate (anti-chute — §4).
 *
 * Score = (1 − taxa) × confiança_volume × peso_incidência_normalizado × 100
 *
 * O nó só vira ALVO se volume_ok === true E weaknessScore !== null.
 */
export function weaknessScore(
  no: NoDiagnostico,
  cfg: WeaknessConfig = DEFAULTS
): number | null {
  if (no.nFeitas < cfg.gateVolume) return null; // GATE — não declara fraqueza

  const erro = 1 - no.taxa;
  const confianca = Math.min(1, no.nFeitas / cfg.volumeConfiancaPlena);
  const incid = no.pesoIncidencia / cfg.incidenciaMax;

  return erro * confianca * incid * 100;
}

/**
 * Ordena nós por score de fraqueza (maior primeiro).
 * Nós sem volume suficiente ficam no final, marcados como "amostra insuficiente".
 */
export function ranquearNos(
  nos: NoDiagnostico[],
  cfg: WeaknessConfig = DEFAULTS
): Array<{ no: NoDiagnostico; score: number | null }> {
  return nos
    .map((no) => ({ no, score: weaknessScore(no, cfg) }))
    .sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });
}
