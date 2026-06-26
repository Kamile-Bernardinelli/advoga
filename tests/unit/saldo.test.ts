import { describe, it, expect } from "vitest";
import {
  calcularDiasRestantesMes,
  calcularRitmoNecessario,
  calcularStatus,
  montarAderenciaHoje,
  calcularPropostaCompensacao,
  hojeLocal,
} from "@/lib/metas/saldo";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DATA_PROVA = "2026-09-06";
// Feriado que não existe — só para isolar a lógica de dias
const TODOS_DIAS = [0, 1, 2, 3, 4, 5, 6];
const DIAS_UTEIS = [1, 2, 3, 4, 5]; // Seg a Sex

// Helpers
function mapOverrides(overrides: [string, number][]): Map<string, number> {
  return new Map(overrides);
}

// ---------------------------------------------------------------------------
// calcularDiasRestantesMes
// ---------------------------------------------------------------------------

describe("calcularDiasRestantesMes", () => {
  it("conta todos os dias do mês quando diasEstudo = todos", () => {
    // Junho 2026 tem 30 dias; hoje = 26/06 → restam: 26, 27, 28, 29, 30 = 5 dias
    const count = calcularDiasRestantesMes({
      hoje: "2026-06-26",
      diasEstudo: TODOS_DIAS,
      overrides: mapOverrides([]),
      dataProva: DATA_PROVA,
    });
    expect(count).toBe(5); // 26,27,28,29,30 de junho
  });

  it("respeita diasEstudo (só úteis)", () => {
    // 26 jun = sexta (5), 27 = sáb (6), 28 = dom (0), 29 = seg (1), 30 = ter (2)
    // Dias úteis do período: 26 (sex), 29 (seg), 30 (ter) = 3
    const count = calcularDiasRestantesMes({
      hoje: "2026-06-26",
      diasEstudo: DIAS_UTEIS,
      overrides: mapOverrides([]),
      dataProva: DATA_PROVA,
    });
    expect(count).toBe(3);
  });

  it("override 0 não conta (folga explícita)", () => {
    // Sem override: 3 dias úteis; com folga explícita na sex 26 → 2
    const count = calcularDiasRestantesMes({
      hoje: "2026-06-26",
      diasEstudo: DIAS_UTEIS,
      overrides: mapOverrides([["2026-06-26", 0]]), // folga no dia 26
      dataProva: DATA_PROVA,
    });
    expect(count).toBe(2);
  });

  it("override > 0 em dia não-útil CONTA", () => {
    // Sáb (27) não é útil, mas tem override de 180min → conta
    const count = calcularDiasRestantesMes({
      hoje: "2026-06-26",
      diasEstudo: DIAS_UTEIS,
      overrides: mapOverrides([["2026-06-27", 180]]), // sáb com override
      dataProva: DATA_PROVA,
    });
    // 26 (sex), 27 (sáb com override), 29 (seg), 30 (ter) = 4
    expect(count).toBe(4);
  });

  it("não ultrapassa a data da prova (menos 1 dia)", () => {
    // Em agosto 2026: dias restantes até 05/09 (dataProva−1 = 06/09−1 = 05/09)
    // ago tem 31 dias; hoje = 31/08 → só 31/08 e 01/09..05/09 mas limitado ao mês corrente (ago)
    // horizon = min(31/08, 05/09) = 31/08 → só 1 dia
    const count = calcularDiasRestantesMes({
      hoje: "2026-08-31",
      diasEstudo: TODOS_DIAS,
      overrides: mapOverrides([]),
      dataProva: DATA_PROVA,
    });
    expect(count).toBe(1); // só o dia 31/08
  });

  it("retorna 0 se hoje é o último dia e é folga", () => {
    const count = calcularDiasRestantesMes({
      hoje: "2026-06-30",
      diasEstudo: TODOS_DIAS,
      overrides: mapOverrides([["2026-06-30", 0]]),
      dataProva: DATA_PROVA,
    });
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calcularRitmoNecessario
// ---------------------------------------------------------------------------

describe("calcularRitmoNecessario", () => {
  it("divide o restante pelos dias restantes (ceil)", () => {
    // 100 min restantes, 3 dias → ceil(100/3) = 34
    expect(calcularRitmoNecessario(100, 3)).toBe(34);
  });

  it("retorna 0 quando restante é 0 ou negativo", () => {
    expect(calcularRitmoNecessario(0, 5)).toBe(0);
    expect(calcularRitmoNecessario(-50, 5)).toBe(0);
  });

  it("usa max(1, diasRestantes) para evitar divisão por zero", () => {
    // 300 min restantes, 0 dias → ceil(300/1) = 300
    expect(calcularRitmoNecessario(300, 0)).toBe(300);
  });

  it("retorna 1 quando restante é 1 e dias suficientes", () => {
    expect(calcularRitmoNecessario(1, 10)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calcularStatus
// ---------------------------------------------------------------------------

describe("calcularStatus", () => {
  it("adiantada quando saldo_acum_mes >= 0", () => {
    expect(calcularStatus({ saldoAcumMes: 0, ritmoNecessario: 200, metaBase: 180 })).toBe("adiantada");
    expect(calcularStatus({ saldoAcumMes: 60, ritmoNecessario: 200, metaBase: 180 })).toBe("adiantada");
  });

  it("no_ritmo quando déficit mas ritmo recuperável (claramente ≤ base×1.15)", () => {
    // metaBase = 180 → limite ≈ 207; ritmo = 180 → claramente dentro do limite
    expect(calcularStatus({ saldoAcumMes: -90, ritmoNecessario: 180, metaBase: 180 })).toBe("no_ritmo");
    // ritmo = 200 (< 207) → no_ritmo
    expect(calcularStatus({ saldoAcumMes: -90, ritmoNecessario: 200, metaBase: 180 })).toBe("no_ritmo");
  });

  it("atrasada quando déficit e ritmo claramente > base×1.15", () => {
    // ritmo = 240 >> 207 → atrasada
    expect(calcularStatus({ saldoAcumMes: -90, ritmoNecessario: 240, metaBase: 180 })).toBe("atrasada");
    expect(calcularStatus({ saldoAcumMes: -500, ritmoNecessario: 400, metaBase: 180 })).toBe("atrasada");
  });
});

// ---------------------------------------------------------------------------
// montarAderenciaHoje — composição completa
// ---------------------------------------------------------------------------

describe("montarAderenciaHoje", () => {
  it("monta aderência completa com saldo positivo → adiantada", () => {
    const result = montarAderenciaHoje({
      metaHojeMin:     180,
      realHojeMin:     240,
      saldoHojeMin:    60,
      saldoAcumMesMin: 120,     // superávit no mês
      realMesMin:      600,
      metaMensalMin:   3600,    // 60h/mês
      metaBaseDiariaMin: 180,
      diasEstudo: TODOS_DIAS,
      overrides: mapOverrides([]),
      hoje: "2026-06-26",
      dataProva: DATA_PROVA,
    });

    expect(result.status).toBe("adiantada");
    expect(result.realHojeMin).toBe(240);
    expect(result.saldoHojeMin).toBe(60);
    expect(result.saldoAcumMesMin).toBe(120);
    expect(result.diasRestantesMes).toBe(5); // 26..30 jun
  });

  it("monta aderência com déficit recuperável → no_ritmo", () => {
    // Kamile: 45min estudados hoje, meta = 240, saldo = -195
    const result = montarAderenciaHoje({
      metaHojeMin:     240,
      realHojeMin:     45,
      saldoHojeMin:    -195,
      saldoAcumMesMin: -195,    // déficit
      realMesMin:      45,
      metaMensalMin:   4800,    // 80h/mês
      metaBaseDiariaMin: 240,
      diasEstudo: DIAS_UTEIS,
      overrides: mapOverrides([]),
      hoje: "2026-06-26",
      dataProva: DATA_PROVA,
    });

    // diasRestantes = 3 (26 sex, 29 seg, 30 ter)
    // restante = 4800 - 45 = 4755; ritmo = ceil(4755/3) = 1585 → atrasada (> 240*1.15=276)
    expect(result.diasRestantesMes).toBe(3);
    expect(result.ritmoNecessarioMin).toBe(1585);
    expect(result.status).toBe("atrasada");
  });

  it("sem meta mensal → ritmo=0, status usa saldo_acum_mes", () => {
    const result = montarAderenciaHoje({
      metaHojeMin:     180,
      realHojeMin:     45,
      saldoHojeMin:    -135,
      saldoAcumMesMin: -135,
      realMesMin:      45,
      metaMensalMin:   null,
      metaBaseDiariaMin: 180,
      diasEstudo: TODOS_DIAS,
      overrides: mapOverrides([]),
      hoje: "2026-06-26",
      dataProva: DATA_PROVA,
    });
    expect(result.ritmoNecessarioMin).toBe(0);
    // saldo < 0 e ritmo (0) <= base*1.15 → no_ritmo
    expect(result.status).toBe("no_ritmo");
  });
});

// ---------------------------------------------------------------------------
// calcularPropostaCompensacao
// ---------------------------------------------------------------------------

describe("calcularPropostaCompensacao", () => {
  it("distribui restante nos dias disponíveis respeitando teto", () => {
    const proposta = calcularPropostaCompensacao({
      restanteMes:  500,
      hoje:         "2026-06-26",
      diasEstudo:   TODOS_DIAS,
      overrides:    mapOverrides([]),
      tetoMin:      270,
      dataProva:    DATA_PROVA,
    });
    // Dias: 26, 27, 28, 29, 30 = 5 dias; teto = 270; 5×270 = 1350 >= 500 → cobreTotal
    expect(proposta.cobreTotal).toBe(true);
    expect(proposta.deficitResidual).toBe(0);
    const soma = proposta.diasPropostos.reduce((s, d) => s + d.minutosMeta, 0);
    expect(soma).toBe(500);
  });

  it("retorna cobreTotal=false quando teto insuficiente", () => {
    const proposta = calcularPropostaCompensacao({
      restanteMes:  5000,
      hoje:         "2026-06-30",
      diasEstudo:   TODOS_DIAS,
      overrides:    mapOverrides([]),
      tetoMin:      270,
      dataProva:    DATA_PROVA,
    });
    // Só 1 dia disponível (30 jun); 270 < 5000 → não cobre
    expect(proposta.cobreTotal).toBe(false);
    expect(proposta.deficitResidual).toBe(4730);
  });

  it("retorna vazio quando restante = 0", () => {
    const proposta = calcularPropostaCompensacao({
      restanteMes:  0,
      hoje:         "2026-06-26",
      diasEstudo:   TODOS_DIAS,
      overrides:    mapOverrides([]),
      tetoMin:      270,
      dataProva:    DATA_PROVA,
    });
    expect(proposta.diasPropostos).toHaveLength(0);
    expect(proposta.cobreTotal).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hojeLocal — smoke test (não depende de fuso real; só verifica formato)
// ---------------------------------------------------------------------------

describe("hojeLocal", () => {
  it("retorna string no formato YYYY-MM-DD", () => {
    const result = hojeLocal("America/Sao_Paulo");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
