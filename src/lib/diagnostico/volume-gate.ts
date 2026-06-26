// Gate de volume — constante calibrável.
// Espelha o valor em lib/planner/config.ts e nas views SQL (diag_gate_minimo()).
// Única fonte de verdade no app (o DB tem a função SQL como espelho).

export const GATE_VOLUME = 8;

/**
 * Retorna true se o nó tem volume suficiente para declarar fraqueza.
 * Abaixo disso: "amostra insuficiente — vou te dar mais disso para medir" (brief §4).
 */
export function volumeOk(nFeitas: number): boolean {
  return nFeitas >= GATE_VOLUME;
}
