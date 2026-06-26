import { describe, it, expect } from "vitest";
import { weaknessScore, DEFAULTS } from "@/lib/diagnostico/weakness-score";
import type { NoDiagnostico } from "@/lib/types/domain";

const baseNo: NoDiagnostico = {
  noId: "subtema-123",
  noNome: "Posse",
  eixo: "subtema",
  nFeitas: 20,
  nAcertos: 8,
  taxa: 0.4,
  pesoIncidencia: 10,
  volumeOk: true,
};

describe("weaknessScore", () => {
  it("retorna null quando volume abaixo do gate (anti-chute)", () => {
    const no = { ...baseNo, nFeitas: 5, volumeOk: false };
    expect(weaknessScore(no)).toBeNull();
  });

  it("retorna score positivo quando volume suficiente e taxa baixa", () => {
    const score = weaknessScore(baseNo);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(0);
  });

  it("retorna 0 quando taxa é 100% (sem erro)", () => {
    const no = { ...baseNo, taxa: 1.0, nAcertos: 20 };
    expect(weaknessScore(no)).toBe(0);
  });

  it("score maior para taxa menor (mais erros = mais fraqueza)", () => {
    const fraco = weaknessScore({ ...baseNo, taxa: 0.2 })!;
    const forte = weaknessScore({ ...baseNo, taxa: 0.8 })!;
    expect(fraco).toBeGreaterThan(forte);
  });

  it("gate configurável", () => {
    const cfg = { ...DEFAULTS, gateVolume: 15 };
    const no = { ...baseNo, nFeitas: 10 }; // abaixo do gate customizado
    expect(weaknessScore(no, cfg)).toBeNull();
  });
});
