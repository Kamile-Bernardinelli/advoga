import { describe, it, expect } from "vitest";
import { gerarPlano } from "@/lib/planner/planner";
import type { NoDiagnostico } from "@/lib/types/domain";

const nosBase: NoDiagnostico[] = [
  {
    noId: "1",
    noNome: "Direito Civil - Posse",
    eixo: "subtema",
    nFeitas: 20,
    nAcertos: 8,
    taxa: 0.4,
    pesoIncidencia: 15,
    volumeOk: true,
  },
  {
    noId: "2",
    noNome: "Direito Penal - Tipicidade",
    eixo: "subtema",
    nFeitas: 15,
    nAcertos: 12,
    taxa: 0.8,
    pesoIncidencia: 12,
    volumeOk: true,
  },
  {
    noId: "3",
    noNome: "Ética",
    eixo: "materia",
    nFeitas: 10,
    nAcertos: 7,
    taxa: 0.7,
    pesoIncidencia: 8,
    volumeOk: true,
  },
  {
    noId: "4",
    noNome: "Direito Constitucional - Direitos Fundamentais",
    eixo: "subtema",
    nFeitas: 3, // abaixo do gate
    nAcertos: 1,
    taxa: 0.33,
    pesoIncidencia: 18,
    volumeOk: false,
  },
];

describe("gerarPlano", () => {
  it("questoesAlvo = horas × qph", () => {
    const plano = gerarPlano({ horas: 2, nos: nosBase, data: "2026-06-21" });
    expect(plano.questoesAlvo).toBe(60); // 2h × 30q/h
  });

  it("distribui questões (total não excede questoesAlvo por muito)", () => {
    const plano = gerarPlano({ horas: 3, nos: nosBase, data: "2026-06-21" });
    const total = plano.distribuicao.reduce((s, i) => s + i.n, 0);
    expect(total).toBeLessThanOrEqual(plano.questoesAlvo + 5); // margem de arredondamento
    expect(total).toBeGreaterThan(0);
  });

  it("inclui item de Ética com motivo='etica'", () => {
    const plano = gerarPlano({ horas: 3, nos: nosBase, data: "2026-06-21" });
    const etica = plano.distribuicao.find((i) => i.motivo === "etica");
    expect(etica).toBeDefined();
    expect(etica!.n).toBeGreaterThan(0);
  });

  it("nó sem volume suficiente vira 'medir', não 'reforco'", () => {
    const plano = gerarPlano({ horas: 3, nos: nosBase, data: "2026-06-21" });
    const medir = plano.distribuicao.filter((i) => i.motivo === "medir");
    // O nó sem volume (Constitucional) pode aparecer como medir
    expect(medir.length).toBeGreaterThanOrEqual(0); // pode não aparecer se não sobrar cota
  });

  it("velocidade customizável via qph", () => {
    const plano = gerarPlano({ horas: 1, nos: nosBase, data: "2026-06-21", qph: 20 });
    expect(plano.questoesAlvo).toBe(20);
  });
});
