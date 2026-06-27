import { describe, it, expect } from "vitest";
import {
  classificarEsforco,
  classificarEsforcos,
  type EsforcoNoInput,
} from "@/lib/diagnostico/esforco";

// Nó base com padrão confiável, tempo alto e taxa boa
const baseNo: EsforcoNoInput = {
  noId: "materia-123",
  noNome: "Direito Civil",
  eixo: "materia",
  totalMin: 150,
  nFeitas: 20,
  nAcertos: 14,
  taxa: 0.7,
  padraoConfiavel: true,
};

describe("classificarEsforco", () => {
  it("retorna 'medindo' quando padraoConfiavel=false, mesmo com taxa alta e tempo alto", () => {
    const no = { ...baseNo, padraoConfiavel: false };
    const resultado = classificarEsforco(no);
    expect(resultado.quadrante).toBe("medindo");
    expect(resultado.rotulo).toBe("Medindo");
  });

  it("retorna 'dominado' quando confiavel + taxa>=0.6 + tempo>=120", () => {
    const no = { ...baseNo, taxa: 0.7, totalMin: 150, padraoConfiavel: true };
    expect(classificarEsforco(no).quadrante).toBe("dominado");
  });

  it("retorna 'eficiente' quando confiavel + taxa>=0.6 + tempo<120", () => {
    const no = { ...baseNo, taxa: 0.65, totalMin: 90, padraoConfiavel: true };
    expect(classificarEsforco(no).quadrante).toBe("eficiente");
  });

  it("retorna 'esforco_sem_retorno' quando confiavel + taxa<0.6 + tempo>=120", () => {
    const no = { ...baseNo, taxa: 0.5, totalMin: 130, padraoConfiavel: true };
    expect(classificarEsforco(no).quadrante).toBe("esforco_sem_retorno");
  });

  it("retorna 'subexposto' quando confiavel + taxa<0.6 + tempo<120", () => {
    const no = { ...baseNo, taxa: 0.4, totalMin: 50, padraoConfiavel: true };
    expect(classificarEsforco(no).quadrante).toBe("subexposto");
  });

  it("limite exato: taxa=0.6 é considerada 'boa' (>= 0.6)", () => {
    const no = { ...baseNo, taxa: 0.6, totalMin: 50, padraoConfiavel: true };
    expect(classificarEsforco(no).quadrante).toBe("eficiente");
  });

  it("limite exato: tempo=120 é considerado 'alto' (>= 120)", () => {
    const no = { ...baseNo, taxa: 0.7, totalMin: 120, padraoConfiavel: true };
    expect(classificarEsforco(no).quadrante).toBe("dominado");
  });

  it("limiares customizáveis substituem os padrões", () => {
    const no = { ...baseNo, taxa: 0.5, totalMin: 90, padraoConfiavel: true };
    // Com limiares customizados: taxaBoa=0.4, tempoAltoMin=100 → tempo<100, taxa>=0.4 → eficiente
    const resultado = classificarEsforco(no, { taxaBoa: 0.4, tempoAltoMin: 100 });
    expect(resultado.quadrante).toBe("eficiente");
  });

  it("carrega o rótulo PT-BR correto para cada quadrante", () => {
    expect(classificarEsforco({ ...baseNo, taxa: 0.7, totalMin: 150 }).rotulo).toBe("Dominado");
    expect(classificarEsforco({ ...baseNo, taxa: 0.7, totalMin: 90 }).rotulo).toBe("Eficiente");
    expect(classificarEsforco({ ...baseNo, taxa: 0.4, totalMin: 150 }).rotulo).toBe("Esforço sem retorno");
    expect(classificarEsforco({ ...baseNo, taxa: 0.4, totalMin: 90 }).rotulo).toBe("Subexposto");
    expect(classificarEsforco({ ...baseNo, padraoConfiavel: false }).rotulo).toBe("Medindo");
  });
});

describe("classificarEsforcos", () => {
  it("mapeia um array misto e retorna o quadrante correto para cada nó", () => {
    const nos: EsforcoNoInput[] = [
      { ...baseNo, noId: "a", taxa: 0.7, totalMin: 150, padraoConfiavel: true },   // dominado
      { ...baseNo, noId: "b", taxa: 0.7, totalMin: 90,  padraoConfiavel: true },   // eficiente
      { ...baseNo, noId: "c", taxa: 0.4, totalMin: 150, padraoConfiavel: true },   // esforco_sem_retorno
      { ...baseNo, noId: "d", taxa: 0.4, totalMin: 90,  padraoConfiavel: true },   // subexposto
      { ...baseNo, noId: "e", padraoConfiavel: false },                            // medindo
    ];

    const resultado = classificarEsforcos(nos);

    expect(resultado).toHaveLength(5);
    expect(resultado[0].quadrante).toBe("dominado");
    expect(resultado[1].quadrante).toBe("eficiente");
    expect(resultado[2].quadrante).toBe("esforco_sem_retorno");
    expect(resultado[3].quadrante).toBe("subexposto");
    expect(resultado[4].quadrante).toBe("medindo");
  });

  it("array vazio retorna array vazio", () => {
    expect(classificarEsforcos([])).toHaveLength(0);
  });
});
