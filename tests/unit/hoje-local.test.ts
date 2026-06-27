import { describe, it, expect, vi, afterEach } from "vitest";
import { hojeLocal } from "@/lib/metas/saldo";

// Regressão da Ponta 2 (drift de fuso UTC → dia errado à noite, M-7).
// À noite no Brasil (UTC-3), o instante já virou o dia seguinte em UTC;
// hojeLocal DEVE devolver o dia LOCAL da usuária, não o UTC. Esse era o bug
// em planner.actions/cronograma.actions (new Date().toISOString()).

describe("hojeLocal — corretude de fuso (anti-drift UTC)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("às 23h em São Paulo (já 02h UTC do dia seguinte) devolve o dia LOCAL", () => {
    vi.useFakeTimers();
    // 2026-06-27T02:00:00Z === 2026-06-26 23:00 em America/Sao_Paulo (UTC-3)
    vi.setSystemTime(new Date("2026-06-27T02:00:00Z"));

    // O fix: dia local da usuária.
    expect(hojeLocal("America/Sao_Paulo")).toBe("2026-06-26");
    // Sanity: no mesmo instante, em UTC já é o dia 27 — exatamente o bug antigo.
    expect(hojeLocal("UTC")).toBe("2026-06-27");
  });

  it("de dia, fuso local e UTC coincidem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T15:00:00Z")); // 12h BRT
    expect(hojeLocal("America/Sao_Paulo")).toBe("2026-06-26");
    expect(hojeLocal("UTC")).toBe("2026-06-26");
  });

  it("sempre no formato YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));
    expect(hojeLocal("America/Sao_Paulo")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
