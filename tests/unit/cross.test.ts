import { describe, it, expect } from "vitest";
import {
  agregarCaracteristicas,
  type CelulaCrossInput,
} from "@/lib/diagnostico/cross";

// Célula base: dimensão booleana confiável
const baseCelula: CelulaCrossInput = {
  dimensaoChave: "enunciado_longo",
  dimensaoNome: "Enunciado longo",
  valorNome: "true",
  nFeitas: 10,
  nAcertos: 6,
};

describe("agregarCaracteristicas — agregação", () => {
  it("soma nFeitas e nAcertos de células com mesmo (dimensaoChave, valorNome)", () => {
    const celulas: CelulaCrossInput[] = [
      { ...baseCelula, nFeitas: 5, nAcertos: 3 },
      { ...baseCelula, nFeitas: 6, nAcertos: 4 },
    ];
    const [r] = agregarCaracteristicas(celulas);
    expect(r.nFeitas).toBe(11);
    expect(r.nAcertos).toBe(7);
  });

  it("trata células de dimensões distintas como itens separados", () => {
    const celulas: CelulaCrossInput[] = [
      { ...baseCelula, dimensaoChave: "enunciado_longo", valorNome: "true", nFeitas: 5, nAcertos: 3 },
      {
        dimensaoChave: "estilo_cognitivo",
        dimensaoNome: "Estilo cognitivo",
        valorNome: "caso-concreto",
        nFeitas: 8,
        nAcertos: 4,
      },
    ];
    const resultado = agregarCaracteristicas(celulas);
    expect(resultado).toHaveLength(2);
  });

  it("array vazio retorna array vazio", () => {
    expect(agregarCaracteristicas([])).toHaveLength(0);
  });
});

describe("agregarCaracteristicas — gate e veredito", () => {
  it("retorna 'medindo' quando nFeitas total < gate (8), mesmo taxa=1.0", () => {
    const celulas: CelulaCrossInput[] = [
      { ...baseCelula, nFeitas: 3, nAcertos: 3 },
      { ...baseCelula, nFeitas: 4, nAcertos: 4 },
      // total=7 < 8
    ];
    const [r] = agregarCaracteristicas(celulas);
    expect(r.nFeitas).toBe(7);
    expect(r.veredicto).toBe("medindo");
    expect(r.confiavel).toBe(false);
  });

  it("retorna 'forte' quando confiável e taxa >= 0.6", () => {
    const celulas: CelulaCrossInput[] = [
      { ...baseCelula, nFeitas: 10, nAcertos: 7 }, // taxa=0.7 >= 0.6
    ];
    const [r] = agregarCaracteristicas(celulas);
    expect(r.veredicto).toBe("forte");
    expect(r.confiavel).toBe(true);
  });

  it("retorna 'fraco' quando confiável e taxa < 0.6", () => {
    const celulas: CelulaCrossInput[] = [
      { ...baseCelula, nFeitas: 10, nAcertos: 5 }, // taxa=0.5 < 0.6
    ];
    const [r] = agregarCaracteristicas(celulas);
    expect(r.veredicto).toBe("fraco");
  });

  it("limite exato: nFeitas=8 (= gate) → confiável", () => {
    const celulas: CelulaCrossInput[] = [
      { ...baseCelula, nFeitas: 8, nAcertos: 6 },
    ];
    const [r] = agregarCaracteristicas(celulas);
    expect(r.confiavel).toBe(true);
  });

  it("limite exato: taxa=0.6 → 'forte' (>= 0.6 é boa)", () => {
    const celulas: CelulaCrossInput[] = [
      { ...baseCelula, nFeitas: 10, nAcertos: 6 }, // taxa=0.6
    ];
    const [r] = agregarCaracteristicas(celulas);
    expect(r.veredicto).toBe("forte");
  });

  it("suporta limiares customizados", () => {
    // gate=5, taxaBoa=0.8: nFeitas=6 passa o gate, mas taxa=0.7 < 0.8 → fraco
    const celulas: CelulaCrossInput[] = [
      { ...baseCelula, nFeitas: 6, nAcertos: 4 }, // taxa≈0.667
    ];
    const [r] = agregarCaracteristicas(celulas, { gate: 5, taxaBoa: 0.8 });
    expect(r.confiavel).toBe(true);
    expect(r.veredicto).toBe("fraco");
  });
});

describe("agregarCaracteristicas — rótulo", () => {
  it("dimensão booleana (valorNome='true') → label = dimensaoNome", () => {
    const celulas: CelulaCrossInput[] = [
      { ...baseCelula, valorNome: "true", dimensaoNome: "Enunciado longo", nFeitas: 10, nAcertos: 6 },
    ];
    const [r] = agregarCaracteristicas(celulas);
    expect(r.label).toBe("Enunciado longo");
  });

  it("dimensão booleana (valorNome='false') → label = dimensaoNome", () => {
    const celulas: CelulaCrossInput[] = [
      {
        ...baseCelula,
        valorNome: "false",
        dimensaoNome: "Enunciado longo",
        nFeitas: 10,
        nAcertos: 6,
      },
    ];
    const [r] = agregarCaracteristicas(celulas);
    expect(r.label).toBe("Enunciado longo");
  });

  it("dimensão categórica → label = valorNome", () => {
    const celulas: CelulaCrossInput[] = [
      {
        dimensaoChave: "estilo_cognitivo",
        dimensaoNome: "Estilo cognitivo",
        valorNome: "caso-concreto",
        nFeitas: 10,
        nAcertos: 6,
      },
    ];
    const [r] = agregarCaracteristicas(celulas);
    expect(r.label).toBe("caso-concreto");
  });
});

describe("agregarCaracteristicas — ordenação", () => {
  it("confiáveis aparecem antes dos 'medindo'", () => {
    const celulas: CelulaCrossInput[] = [
      // medindo: nFeitas=5 < 8
      { dimensaoChave: "dim_a", dimensaoNome: "A", valorNome: "x", nFeitas: 5, nAcertos: 5 },
      // confiável: nFeitas=10 >= 8
      { dimensaoChave: "dim_b", dimensaoNome: "B", valorNome: "y", nFeitas: 10, nAcertos: 6 },
    ];
    const resultado = agregarCaracteristicas(celulas);
    expect(resultado[0].confiavel).toBe(true);
    expect(resultado[1].confiavel).toBe(false);
  });

  it("entre confiáveis, pior taxa aparece primeiro (mais acionável)", () => {
    const celulas: CelulaCrossInput[] = [
      // taxa=0.8 (forte)
      { dimensaoChave: "dim_a", dimensaoNome: "A", valorNome: "x", nFeitas: 10, nAcertos: 8 },
      // taxa=0.5 (fraco — pior, deve vir primeiro)
      { dimensaoChave: "dim_b", dimensaoNome: "B", valorNome: "y", nFeitas: 10, nAcertos: 5 },
    ];
    const resultado = agregarCaracteristicas(celulas);
    expect(resultado[0].dimensaoChave).toBe("dim_b"); // taxa=0.5 primeiro
    expect(resultado[1].dimensaoChave).toBe("dim_a"); // taxa=0.8 depois
  });

  it("entre 'medindo', mais feitas aparecem primeiro", () => {
    const celulas: CelulaCrossInput[] = [
      { dimensaoChave: "dim_a", dimensaoNome: "A", valorNome: "x", nFeitas: 3, nAcertos: 3 },
      { dimensaoChave: "dim_b", dimensaoNome: "B", valorNome: "y", nFeitas: 6, nAcertos: 6 },
    ];
    const resultado = agregarCaracteristicas(celulas);
    // ambos medindo (3 < 8, 6 < 8)
    expect(resultado[0].nFeitas).toBe(6);
    expect(resultado[1].nFeitas).toBe(3);
  });
});
