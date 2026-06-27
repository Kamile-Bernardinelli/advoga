import { describe, it, expect } from "vitest";
import { COLUNAS_QUESTAO_PROVA, COLUNAS_RESPOSTA_PROIBIDAS } from "@/lib/teste/colunas-prova";

describe("gabarito não vaza (fronteira de segurança)", () => {
  it("a lista de colunas públicas da prova não contém nenhuma coluna de resposta", () => {
    for (const proibida of COLUNAS_RESPOSTA_PROIBIDAS) {
      expect(COLUNAS_QUESTAO_PROVA as readonly string[]).not.toContain(proibida);
    }
  });
});
