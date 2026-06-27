// Classificador de Desempenho por Característica da Questão — PURO, testável sem DB.
// Agrega células granulares (subtema × dimensão × valor) e emite um veredito por característica.
// Anti-chute §4: veredito ("forte"/"fraco") APENAS quando nFeitas >= gateVolume.
//               Abaixo do gate → "medindo" (nunca um veredito de força).
import { gateVolume, taxaBoaEsforco } from "@/lib/planner/config";

export type VeredictoCaracteristica = "forte" | "fraco" | "medindo";

/** Entrada granular: uma linha da view diag_cross_subtema_dimensao (já mapeada). */
export interface CelulaCrossInput {
  dimensaoChave: string;
  dimensaoNome: string;
  valorNome: string; // categórico: o valor; booleano: "true" | "false"
  nFeitas: number;
  nAcertos: number;
}

/** Saída agregada por (dimensaoChave, valorNome). */
export interface CaracteristicaDesempenho {
  /** Chave estável para React key: `${dimensaoChave}:${valorNome}` */
  chave: string;
  /** Rótulo de exibição — aplica regra de booleano (ver rotuloCaracteristica). */
  label: string;
  dimensaoChave: string;
  dimensaoNome: string;
  nFeitas: number;
  nAcertos: number;
  /** Taxa de acerto 0..1 (calculada após agregação). */
  taxa: number;
  /** true quando nFeitas >= gate. */
  confiavel: boolean;
  veredicto: VeredictoCaracteristica;
}

export interface LimiaresCross {
  taxaBoa: number;
  gate: number;
}

const LIMIARES_DEFAULT: LimiaresCross = {
  taxaBoa: taxaBoaEsforco,
  gate: gateVolume,
};

/**
 * Determina o rótulo de exibição da característica.
 *
 * - Dimensão booleana (valorNome = "true" | "false"): o traço em si é a dimensão
 *   (ex: "Enunciado longo"). Usamos o nome da dimensão como rótulo.
 * - Dimensão categórica (valorNome = "caso-concreto" etc.): o valor é o rótulo.
 */
function rotuloCaracteristica(c: {
  dimensaoNome: string;
  valorNome: string;
}): string {
  const v = c.valorNome?.toLowerCase();
  if (v === "true" || v === "false") return c.dimensaoNome;
  return c.valorNome;
}

/**
 * Agrega células granulares (subtema × dimensão × valor) por (dimensaoChave, valorNome)
 * e classifica cada característica com um veredito anti-chute.
 *
 * Ordem de saída: confiáveis primeiro (pior taxa → mais acionável); "medindo" por último.
 */
export function agregarCaracteristicas(
  celulas: CelulaCrossInput[],
  lim: LimiaresCross = LIMIARES_DEFAULT
): CaracteristicaDesempenho[] {
  const map = new Map<string, CaracteristicaDesempenho>();

  for (const c of celulas) {
    const chave = `${c.dimensaoChave}:${c.valorNome}`;
    const cur = map.get(chave) ?? {
      chave,
      label: rotuloCaracteristica(c),
      dimensaoChave: c.dimensaoChave,
      dimensaoNome: c.dimensaoNome,
      nFeitas: 0,
      nAcertos: 0,
      taxa: 0,
      confiavel: false,
      veredicto: "medindo" as VeredictoCaracteristica,
    };
    cur.nFeitas += c.nFeitas;
    cur.nAcertos += c.nAcertos;
    map.set(chave, cur);
  }

  const out = [...map.values()].map((c) => {
    const taxa = c.nFeitas > 0 ? c.nAcertos / c.nFeitas : 0;
    const confiavel = c.nFeitas >= lim.gate;
    const veredicto: VeredictoCaracteristica = !confiavel
      ? "medindo"
      : taxa >= lim.taxaBoa
        ? "forte"
        : "fraco";
    return { ...c, taxa, confiavel, veredicto };
  });

  // Confiáveis primeiro (pior taxa → mais acionável); entre medindo → mais feitas primeiro.
  return out.sort((a, b) => {
    if (a.confiavel !== b.confiavel) return a.confiavel ? -1 : 1;
    if (a.confiavel) return a.taxa - b.taxa;
    return b.nFeitas - a.nFeitas;
  });
}
