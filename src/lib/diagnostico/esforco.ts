// Classificador de Esforço × Resultado — PURO, testável sem DB.
// Alinha-se com a view v_esforco_resultado e os limiares do planner/config.ts.
// Anti-chute §4: sem padrão confiável → "medindo" (nunca um veredito de quadrante).
import { taxaBoaEsforco, tempoAltoEsforcoMin } from "@/lib/planner/config";

export type QuadranteEsforco =
  | "eficiente"           // pouco tempo + boa taxa
  | "dominado"            // muito tempo + boa taxa
  | "esforco_sem_retorno" // muito tempo + taxa baixa
  | "subexposto"          // pouco tempo + taxa baixa
  | "medindo";            // sem padrão confiável (gate duplo não batido)

export interface EsforcoNoInput {
  noId: string;
  noNome: string;
  eixo: string;
  totalMin: number;
  nFeitas: number;
  nAcertos: number;
  taxa: number;            // 0..1
  padraoConfiavel: boolean;
}

export interface EsforcoNo extends EsforcoNoInput {
  quadrante: QuadranteEsforco;
  rotulo: string;          // label PT-BR p/ exibir
}

export interface LimiaresEsforco {
  taxaBoa: number;
  tempoAltoMin: number;
}

const LIMIARES_DEFAULT: LimiaresEsforco = {
  taxaBoa: taxaBoaEsforco,
  tempoAltoMin: tempoAltoEsforcoMin,
};

const ROTULOS: Record<QuadranteEsforco, string> = {
  eficiente: "Eficiente",
  dominado: "Dominado",
  esforco_sem_retorno: "Esforço sem retorno",
  subexposto: "Subexposto",
  medindo: "Medindo",
};

/**
 * Classifica UM nó no quadrante de Esforço × Resultado.
 * Anti-chute §4: sem padrão confiável → "medindo" (nunca um veredito de quadrante).
 */
export function classificarEsforco(
  no: EsforcoNoInput,
  lim: LimiaresEsforco = LIMIARES_DEFAULT
): EsforcoNo {
  let quadrante: QuadranteEsforco;

  if (!no.padraoConfiavel) {
    quadrante = "medindo";
  } else {
    const tempoAlto = no.totalMin >= lim.tempoAltoMin;
    const taxaBoa   = no.taxa     >= lim.taxaBoa;

    if (taxaBoa) {
      quadrante = tempoAlto ? "dominado" : "eficiente";
    } else {
      quadrante = tempoAlto ? "esforco_sem_retorno" : "subexposto";
    }
  }

  return { ...no, quadrante, rotulo: ROTULOS[quadrante] };
}

/**
 * Classifica um array de nós.
 */
export function classificarEsforcos(
  nos: EsforcoNoInput[],
  lim?: LimiaresEsforco
): EsforcoNo[] {
  return nos.map((n) => classificarEsforco(n, lim));
}
