import { describe, it, expect } from "vitest";
import {
  eixoEdicoes,
  densificarSerie,
  montarRanking,
} from "@/lib/incidencia/tendencia";
import type { IncidenciaRow, TendenciaRow } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Fixtures helpers
// ---------------------------------------------------------------------------

function incid(
  subtema_id: string,
  n_questoes: number,
  n_disponiveis = 0,
  subtema_nome = subtema_id,
  materia_nome = "Matéria X",
): IncidenciaRow {
  return {
    subtema_id,
    subtema_nome,
    materia_id: "m1",
    materia_nome,
    n_questoes,
    n_disponiveis,
  };
}

function tend(subtema_id: string, exame_numero: number, n_questoes: number): TendenciaRow {
  return { subtema_id, exame_numero, ano: 2020, n_questoes };
}

// ---------------------------------------------------------------------------
// eixoEdicoes
// ---------------------------------------------------------------------------

describe("eixoEdicoes", () => {
  it("retorna edições distintas, ordenadas asc, sem zeros/nulos (§8.1)", () => {
    const rows: TendenciaRow[] = [
      tend("a", 38, 1),
      tend("b", 41, 1),
      tend("a", 38, 1), // duplicada
      tend("c", 46, 1),
    ];
    expect(eixoEdicoes(rows)).toEqual([38, 41, 46]);
  });

  it("filtra exame_numero null/0 (esparso) e desordenado", () => {
    const rows: TendenciaRow[] = [
      { subtema_id: "a", exame_numero: 45, ano: 2022, n_questoes: 1 },
      { subtema_id: "a", exame_numero: null, ano: null, n_questoes: 0 },
      { subtema_id: "b", exame_numero: 0, ano: 2019, n_questoes: 1 },
      { subtema_id: "c", exame_numero: 39, ano: 2020, n_questoes: 1 },
    ];
    expect(eixoEdicoes(rows)).toEqual([39, 45]);
  });

  it("eixo vazio quando não há tendência", () => {
    expect(eixoEdicoes([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// densificarSerie — a peça correção-crítica (guardrail anti-chute §7 nº4)
// ---------------------------------------------------------------------------

describe("densificarSerie (reintrodução dos ZEROS)", () => {
  it("reintroduz zeros nas edições ausentes (§8.2)", () => {
    // subtema presente só em ed39 e ed45; eixo cobre [38,39,41,45,46]
    const porEdicao = new Map<number, number>([
      [39, 1],
      [45, 1],
    ]);
    const edicoes = [38, 39, 41, 45, 46];
    expect(densificarSerie(porEdicao, edicoes)).toEqual([0, 1, 0, 1, 0]);
  });

  it("série toda zero quando o subtema não aparece em nenhuma edição do eixo", () => {
    expect(densificarSerie(new Map(), [38, 39, 41])).toEqual([0, 0, 0]);
  });

  it("o comprimento da série é sempre = edicoes.length", () => {
    const porEdicao = new Map<number, number>([[41, 2]]);
    const edicoes = [38, 39, 41, 45, 46];
    expect(densificarSerie(porEdicao, edicoes)).toHaveLength(edicoes.length);
  });
});

// ---------------------------------------------------------------------------
// montarRanking — integração: densificação + ordem + escala global
// ---------------------------------------------------------------------------

describe("montarRanking", () => {
  it("ordena as linhas por incidência desc (§8.3)", () => {
    const incidRows = [incid("a", 5), incid("b", 12), incid("c", 8)];
    const { linhas } = montarRanking(incidRows, []);
    expect(linhas.map((l) => l.subtemaId)).toEqual(["b", "c", "a"]);
    expect(linhas.map((l) => l.incidencia)).toEqual([12, 8, 5]);
  });

  it("DENSIFICA os zeros: cada série é alinhada ao eixo GLOBAL, com 0 nas edições ausentes", () => {
    // O eixo é a UNIÃO das edições do corpus. "z" estabelece a ed41 no eixo;
    // "a" caiu só em 38 e 45 → recebe 0 na ed41 (o sinal real de planura/esparsidade).
    const incidRows = [incid("a", 3), incid("z", 1)];
    const tendRows = [tend("a", 38, 2), tend("z", 41, 1), tend("a", 45, 1)];
    const { edicoes, linhas } = montarRanking(incidRows, tendRows);
    expect(edicoes).toEqual([38, 41, 45]);
    const linhaA = linhas.find((l) => l.subtemaId === "a")!;
    expect(linhaA.serie).toEqual([2, 0, 1]); // o 0 do meio (ed41) é o sinal real de planura
  });

  it("toda série tem comprimento = edicoes.length, para qualquer linha (§8.3)", () => {
    const incidRows = [incid("a", 3), incid("b", 1), incid("c", 9)];
    const tendRows = [
      tend("a", 38, 1),
      tend("a", 46, 2),
      tend("c", 41, 3),
    ];
    const { edicoes, linhas } = montarRanking(incidRows, tendRows);
    expect(edicoes).toEqual([38, 41, 46]);
    for (const l of linhas) {
      expect(l.serie).toHaveLength(edicoes.length);
    }
  });

  it("maxSerie é o máximo GLOBAL das células, não o por-linha (§8.4, D4)", () => {
    // subtema "a" tem pico 3; "b" tem pico 1. maxSerie global deve ser 3.
    const incidRows = [incid("a", 4), incid("b", 1)];
    const tendRows = [
      tend("a", 38, 3),
      tend("b", 41, 1),
    ];
    const { maxSerie } = montarRanking(incidRows, tendRows);
    expect(maxSerie).toBe(3);
  });

  it("maxSerie nunca é < 1 (evita divisão por zero na sparkline)", () => {
    const { maxSerie } = montarRanking([incid("a", 0)], []);
    expect(maxSerie).toBe(1);
  });

  it("subtema presente em incid mas AUSENTE de tend → série toda zero, comprimento correto (§8.5)", () => {
    // eixo vem de "b"; "a" não tem nenhuma célula → série [0,0]
    const incidRows = [incid("a", 7), incid("b", 2)];
    const tendRows = [tend("b", 38, 1), tend("b", 46, 1)];
    const { edicoes, linhas } = montarRanking(incidRows, tendRows);
    const linhaA = linhas.find((l) => l.subtemaId === "a")!;
    expect(edicoes).toEqual([38, 46]);
    expect(linhaA.serie).toEqual([0, 0]);
    expect(linhaA.serie).toHaveLength(edicoes.length);
  });

  it("ignora linhas de incidência sem subtema_id (defensivo)", () => {
    const incidRows: IncidenciaRow[] = [
      incid("a", 3),
      { subtema_id: null, subtema_nome: null, materia_id: null, materia_nome: null, n_questoes: 9, n_disponiveis: 0 },
    ];
    const { linhas } = montarRanking(incidRows, []);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].subtemaId).toBe("a");
  });

  it("propaga disponiveis e nomes para o view-model", () => {
    const incidRows = [incid("a", 5, 12, "Posse e propriedade", "Direito Civil")];
    const { linhas } = montarRanking(incidRows, []);
    expect(linhas[0]).toMatchObject({
      subtemaId: "a",
      subtemaNome: "Posse e propriedade",
      materiaNome: "Direito Civil",
      incidencia: 5,
      disponiveis: 12,
    });
  });
});
