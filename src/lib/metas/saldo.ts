// Matemática do saldo e aderência — PURO, testável sem DB.
//
// Princípio: fato em SQL, recomendação no app.
// As views (v_saldo_diario, v_saldo_mensal) entregam real/meta/saldo/acumulado.
// Este módulo calcula dias restantes, ritmo necessário e status — rastreáveis ao número.
//
// Espelha a separação de weakness-score.ts / planner.ts (puro → ação → action → UI).
// dataProva vem de config.ts (single source para todo o app).

import { dataProva as DATA_PROVA } from "@/lib/planner/config";
import type { AderenciaHoje } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Helper: "hoje" no fuso da usuária (corretude de fuso — §8 do spec)
// ---------------------------------------------------------------------------

/**
 * Data atual no fuso informado, no formato YYYY-MM-DD.
 * Usa 'sv-SE' locale que retorna naturalmente YYYY-MM-DD.
 * Evita o drift UTC → dia errado à noite (M-7).
 */
export function hojeLocal(tz: string): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: tz });
}

// ---------------------------------------------------------------------------
// Dias restantes do mês até o mínimo entre fim do mês e a prova
// ---------------------------------------------------------------------------

export interface OpsDiasRestantes {
  /** Data de hoje no fuso da usuária (YYYY-MM-DD). */
  hoje: string;
  /** Array de weekdays de estudo: 0=Dom..6=Sáb (igual JS getDay / EXTRACT DOW). */
  diasEstudo: number[];
  /** Overrides futuros: map data ISO → minutos (0 = folga). */
  overrides: Map<string, number>;
  /** Data da prova (YYYY-MM-DD). Default: dataProva de config. */
  dataProva?: string;
}

/**
 * Conta quantos dias de estudo restam de hoje (inclusive) até
 * min(último dia do mês corrente, dataProva − 1 dia).
 *
 * Regras:
 *   - Se override existe e > 0 → conta.
 *   - Se override = 0 → não conta (folga explícita).
 *   - Sem override → conta se o weekday está em diasEstudo.
 *   - A data da prova em si não é contada (não se estuda no dia da prova).
 */
export function calcularDiasRestantesMes(opts: OpsDiasRestantes): number {
  const { hoje, diasEstudo, overrides } = opts;
  const dataProva = opts.dataProva ?? DATA_PROVA;

  const [year, month] = hoje.split("-").map(Number);
  // Último dia do mês corrente (dia 0 do próximo mês = último dia do mês atual)
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  // Horizonte: mínimo entre fim do mês e (dataProva − 1 dia)
  const provaExclusive = subtractDays(dataProva, 1);
  const horizon = lastDayOfMonth < provaExclusive ? lastDayOfMonth : provaExclusive;

  let count = 0;
  const cur = new Date(hoje + "T00:00:00Z");
  const end = new Date(horizon + "T00:00:00Z");

  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    const dow = cur.getUTCDay();
    const overrideMin = overrides.get(iso);

    if (overrideMin !== undefined) {
      if (overrideMin > 0) count++;
    } else {
      if (diasEstudo.includes(dow)) count++;
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return count;
}

// ---------------------------------------------------------------------------
// Ritmo necessário para fechar a meta mensal
// ---------------------------------------------------------------------------

/**
 * Minutos/dia necessários para fechar restante_mes nos dias que sobram.
 * ceil(restanteMes / max(1, diasRestantes)).
 */
export function calcularRitmoNecessario(
  restanteMes: number,
  diasRestantes: number
): number {
  if (restanteMes <= 0) return 0;
  return Math.ceil(restanteMes / Math.max(1, diasRestantes));
}

// ---------------------------------------------------------------------------
// Status de aderência (rótulo — anti-chute: rastreável ao número)
// ---------------------------------------------------------------------------

/**
 * Rótulo de aderência baseado em saldo acumulado do mês e ritmo necessário.
 *
 * adiantada  → saldo_acum_mes >= 0 (superávit ou zerado)
 * no_ritmo   → déficit mas ritmo recuperável (≤ meta_base × 1.15)
 * atrasada   → déficit e precisa subir o ritmo de forma relevante
 */
export function calcularStatus(opts: {
  saldoAcumMes: number;
  ritmoNecessario: number;
  metaBase: number;
}): "adiantada" | "no_ritmo" | "atrasada" {
  const { saldoAcumMes, ritmoNecessario, metaBase } = opts;
  if (saldoAcumMes >= 0) return "adiantada";
  if (ritmoNecessario <= metaBase * 1.15) return "no_ritmo";
  return "atrasada";
}

// ---------------------------------------------------------------------------
// Proposta de compensação (redistribuição — app layer)
// ---------------------------------------------------------------------------

export interface DiaCompensacao {
  data: string;          // YYYY-MM-DD
  minutosMeta: number;   // minutos propostos (≤ teto)
}

export interface PropostaCompensacao {
  diasPropostos: DiaCompensacao[];
  cobreTotal: boolean;   // true se a soma >= restanteMes
  deficitResidual: number; // se não cobre, quanto sobra
}

/**
 * Distribui o restante do mês pelos dias de estudo futuros respeitando um teto diário.
 * Resultado vira overrides em metas_diarias (Nível A: exibir; Nível B: 1 clique grava).
 */
export function calcularPropostaCompensacao(opts: {
  restanteMes: number;
  hoje: string;
  diasEstudo: number[];
  overrides: Map<string, number>;
  tetoMin: number;       // ex.: minutosTetoCompensacao (270)
  dataProva?: string;
}): PropostaCompensacao {
  const { restanteMes, hoje, diasEstudo, overrides, tetoMin } = opts;
  const dataProva = opts.dataProva ?? DATA_PROVA;

  if (restanteMes <= 0) {
    return { diasPropostos: [], cobreTotal: true, deficitResidual: 0 };
  }

  const [year, month] = hoje.split("-").map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const provaExclusive = subtractDays(dataProva, 1);
  const horizon = lastDayOfMonth < provaExclusive ? lastDayOfMonth : provaExclusive;

  const dias: DiaCompensacao[] = [];
  let acumulado = 0;
  const cur = new Date(hoje + "T00:00:00Z");
  const end = new Date(horizon + "T00:00:00Z");

  while (cur <= end && acumulado < restanteMes) {
    const iso = cur.toISOString().slice(0, 10);
    const dow = cur.getUTCDay();
    const overrideMin = overrides.get(iso);
    const ehDiaEstudo = overrideMin !== undefined ? overrideMin > 0 : diasEstudo.includes(dow);

    if (ehDiaEstudo) {
      const proposta = Math.min(tetoMin, restanteMes - acumulado);
      if (proposta > 0) {
        dias.push({ data: iso, minutosMeta: proposta });
        acumulado += proposta;
      }
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const cobreTotal = acumulado >= restanteMes;
  return {
    diasPropostos: dias,
    cobreTotal,
    deficitResidual: cobreTotal ? 0 : restanteMes - acumulado,
  };
}

// ---------------------------------------------------------------------------
// Montagem de AderenciaHoje (composição das funções acima)
// ---------------------------------------------------------------------------

export interface DadosSaldoHoje {
  metaHojeMin: number;
  realHojeMin: number;
  saldoHojeMin: number;
  saldoAcumMesMin: number;
  realMesMin: number;
  metaMensalMin: number | null;
  metaBaseDiariaMin: number;
  diasEstudo: number[];
  overrides: Map<string, number>; // data → minutos (futuros)
  hoje: string;                   // no fuso da usuária
  dataProva?: string;
}

/**
 * Monta o objeto AderenciaHoje a partir dos fatos das views + config.
 * Funções puras: testável isoladamente.
 */
export function montarAderenciaHoje(dados: DadosSaldoHoje): AderenciaHoje {
  const {
    metaHojeMin, realHojeMin, saldoHojeMin,
    saldoAcumMesMin, realMesMin, metaMensalMin,
    metaBaseDiariaMin, diasEstudo, overrides,
    hoje,
  } = dados;

  const restanteMes = Math.max(0, (metaMensalMin ?? 0) - realMesMin);
  const diasRestantesMes = calcularDiasRestantesMes({
    hoje,
    diasEstudo,
    overrides,
    dataProva: dados.dataProva,
  });
  const ritmoNecessarioMin = metaMensalMin != null
    ? calcularRitmoNecessario(restanteMes, diasRestantesMes)
    : 0;
  const status = calcularStatus({
    saldoAcumMes: saldoAcumMesMin,
    ritmoNecessario: ritmoNecessarioMin,
    metaBase: metaBaseDiariaMin,
  });

  return {
    metaHojeMin,
    realHojeMin,
    saldoHojeMin,
    saldoAcumMesMin,
    realMesMin,
    metaMensalMin,
    diasRestantesMes,
    ritmoNecessarioMin,
    status,
  };
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
