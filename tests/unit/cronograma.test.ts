import { describe, it, expect } from "vitest";
import { gerarCronograma, nomeEhEtica } from "@/lib/planner/cronograma";
import { maxBlocoMin } from "@/lib/planner/config";
import type { NoDiagnostico } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HOJE = "2026-06-26";
const PROVA = "2026-09-06";

const ETICA_ID  = "mat-0000-0000-0000-0000000000a3";
const CIVIL_ID  = "mat-0000-0000-0000-0000000000a1";
const PENAL_ID  = "mat-0000-0000-0000-0000000000a2";
const CONST_ID  = "mat-0000-0000-0000-0000000000a4";
const ADMIN_ID  = "mat-0000-0000-0000-0000000000a5";

const nosBase: NoDiagnostico[] = [
  {
    noId: CIVIL_ID,
    noNome: "Direito Civil",
    eixo: "materia",
    nFeitas: 20,
    nAcertos: 8,
    taxa: 0.4,
    pesoIncidencia: 6,
    volumeOk: true,
  },
  {
    noId: PENAL_ID,
    noNome: "Direito Penal",
    eixo: "materia",
    nFeitas: 15,
    nAcertos: 12,
    taxa: 0.8,
    pesoIncidencia: 6,
    volumeOk: true,
  },
  {
    noId: ETICA_ID,
    noNome: "Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina",
    eixo: "materia",
    nFeitas: 10,
    nAcertos: 7,
    taxa: 0.7,
    pesoIncidencia: 8, // maior incidência → lidera o cold-start
    volumeOk: true,
  },
  {
    noId: CONST_ID,
    noNome: "Direito Constitucional",
    eixo: "materia",
    nFeitas: 3, // abaixo do gate — cold-start puro (peso = incidência)
    nAcertos: 1,
    taxa: 0.33,
    pesoIncidencia: 6,
    volumeOk: false,
  },
  {
    noId: ADMIN_ID,
    noNome: "Direito Administrativo",
    eixo: "materia",
    nFeitas: 0, // zero respostas — menor incidência aqui
    nAcertos: 0,
    taxa: 0,
    pesoIncidencia: 5,
    volumeOk: false,
  },
];

const AMB_ID = "mat-0000-0000-0000-0000000000a6";

// Fixture de COLD START — espelha a situação real da Kamile (começando, sem
// histórico de respostas). Nesse caso o peso de cada nó = incidência pura,
// então a matéria de maior incidência (Ética/Estatuto = 8) lidera.
const nosColdStart: NoDiagnostico[] = [
  { noId: ETICA_ID, noNome: "Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina", eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 8, volumeOk: false },
  { noId: CIVIL_ID, noNome: "Direito Civil",          eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 6, volumeOk: false },
  { noId: CONST_ID, noNome: "Direito Constitucional", eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 6, volumeOk: false },
  { noId: PENAL_ID, noNome: "Direito Penal",          eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 6, volumeOk: false },
  { noId: ADMIN_ID, noNome: "Direito Administrativo", eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 5, volumeOk: false },
  { noId: AMB_ID,   noNome: "Direito Ambiental",      eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 1, volumeOk: false },
];

// Helper: ordena blocos como no DB (data_alvo, ordem)
function ordenarComoDB(blocos: ReturnType<typeof gerarCronograma>) {
  return [...blocos].sort((a, b) => {
    if (a.dataAlvo !== b.dataAlvo) return a.dataAlvo.localeCompare(b.dataAlvo);
    return a.ordem - b.ordem;
  });
}

// ---------------------------------------------------------------------------
// Testes do calendário
// ---------------------------------------------------------------------------

describe("gerarCronograma — calendário", () => {
  it("retorna [] se hoje >= dataProva", () => {
    const blocos = gerarCronograma({
      hoje: "2026-09-06",
      dataProva: "2026-09-06",
      horasPorDia: 4,
      nos: nosBase,
    });
    expect(blocos).toHaveLength(0);
  });

  it("gera blocos apenas nos dias de estudo filtrados", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 3,
      diasEstudo: [1, 3], // segunda e quarta
      nos: nosBase,
    });

    const datasGeradas = new Set(blocos.map((b) => b.dataAlvo));
    for (const data of datasGeradas) {
      const weekday = new Date(data + "T00:00:00").getDay();
      expect([1, 3]).toContain(weekday);
    }
  });

  it("todos os blocos têm dataAlvo < dataProva", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosBase,
    });

    for (const b of blocos) {
      expect(b.dataAlvo < PROVA).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Testes de budget diário + chunking
// ---------------------------------------------------------------------------

describe("gerarCronograma — budget diário e chunking", () => {
  it("nenhum dia ultrapassa o budget diário", () => {
    const horas = 4;
    const budgetMin = horas * 60;

    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: horas,
      nos: nosBase,
    });

    const usadoPorDia = new Map<string, number>();
    for (const b of blocos) {
      usadoPorDia.set(b.dataAlvo, (usadoPorDia.get(b.dataAlvo) ?? 0) + b.minutosAlvo);
    }

    for (const [, minUsado] of usadoPorDia) {
      expect(minUsado).toBeLessThanOrEqual(budgetMin);
    }
  });

  it("nenhum bloco excede maxBlocoMin (chunking aplicado)", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosBase,
    });

    for (const b of blocos) {
      expect(b.minutosAlvo).toBeLessThanOrEqual(maxBlocoMin);
      expect(b.minutosAlvo).toBeGreaterThan(0);
    }
  });

  it("bloco é capado ao budget diário quando horas/dia < maxBlocoMin", () => {
    // 0.5h = 30 min de budget; nenhum bloco pode passar de 30
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 0.5,
      nos: nosBase,
    });

    for (const b of blocos) {
      expect(b.minutosAlvo).toBeLessThanOrEqual(30);
    }
  });

  it("ordem dos blocos começa em 0 e é crescente dentro do dia", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosBase,
    });

    const porDia = new Map<string, number[]>();
    for (const b of blocos) {
      const ordens = porDia.get(b.dataAlvo) ?? [];
      ordens.push(b.ordem);
      porDia.set(b.dataAlvo, ordens);
    }

    for (const [, ordens] of porDia) {
      const ordenadas = [...ordens].sort((a, b) => a - b);
      expect(ordenadas[0]).toBe(0);
      for (let i = 1; i < ordenadas.length; i++) {
        expect(ordenadas[i]).toBe(ordenadas[i - 1] + 1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// BUG 1 FIX — sequenciamento por prioridade
// ---------------------------------------------------------------------------

describe("gerarCronograma — sequenciamento por PRIORIDADE (BUG 1)", () => {
  it("cold-start: o primeiro bloco é da matéria de MAIOR incidência (Ética/Estatuto = 8)", () => {
    const blocos = ordenarComoDB(
      gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosColdStart })
    );

    expect(blocos.length).toBeGreaterThan(0);
    expect(blocos[0].noId).toBe(ETICA_ID);
    expect(blocos[0].tipo).toBe("conteudo"); // e começa por CONTEÚDO
  });

  it("os primeiros blocos lideram com alta prioridade — NÃO com a menor (Ambiental)", () => {
    const blocos = ordenarComoDB(
      gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosColdStart })
    );

    const primeiroIdxEtica = blocos.findIndex((b) => b.noId === ETICA_ID);
    const primeiroIdxAmb   = blocos.findIndex((b) => b.noId === AMB_ID);

    // a matéria de maior incidência aparece ANTES da de menor incidência
    expect(primeiroIdxEtica).toBe(0);
    expect(primeiroIdxAmb).toBeGreaterThan(primeiroIdxEtica);

    // entre os 5 primeiros blocos NÃO deve aparecer a matéria de menor incidência
    const top5 = blocos.slice(0, 5).map((b) => b.noId);
    expect(top5).not.toContain(AMB_ID);
  });

  it("os primeiros blocos do dia 1 são todos CONTEÚDO (leitura lidera)", () => {
    const blocos = ordenarComoDB(
      gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosColdStart })
    );
    const primeiros = blocos.slice(0, 4);
    for (const b of primeiros) {
      expect(b.tipo).toBe("conteudo");
    }
  });

  it("com dados reais, a matéria fraca+incidente (Civil) pode liderar acima de Ética (correto)", () => {
    // nosBase: Civil tem taxa 0.4 (fraca) + 20 questões → weaknessScore alto.
    // Ética tem taxa 0.7 (ok) → weaknessScore baixo. Civil DEVE liderar.
    const blocos = ordenarComoDB(
      gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosBase })
    );
    expect(blocos[0].noId).toBe(CIVIL_ID);
    expect(blocos[0].tipo).toBe("conteudo");
  });
});

// ---------------------------------------------------------------------------
// BUG 1 FIX — conteúdo antes de questões da MESMA matéria
// ---------------------------------------------------------------------------

describe("gerarCronograma — conteúdo antes de questões por matéria (BUG 1)", () => {
  it("para cada matéria, todo CONTEÚDO vem antes (data) de toda QUESTÃO", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosBase,
    });

    const porNo = new Map<string, { conteudo: string[]; questoes: string[] }>();
    for (const b of blocos) {
      if (b.tipo === "revisao") continue;
      const entry = porNo.get(b.noId) ?? { conteudo: [], questoes: [] };
      if (b.tipo === "conteudo") entry.conteudo.push(b.dataAlvo);
      if (b.tipo === "questoes") entry.questoes.push(b.dataAlvo);
      porNo.set(b.noId, entry);
    }

    for (const [, { conteudo, questoes }] of porNo) {
      if (conteudo.length === 0 || questoes.length === 0) continue;
      const ultimoConteudo = conteudo.sort()[conteudo.length - 1];
      const primeiraQuestao = questoes.sort()[0];
      // questões ≥1 dia DEPOIS da última leitura → estritamente maior
      expect(primeiraQuestao > ultimoConteudo).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Testes de dose de Ética
// ---------------------------------------------------------------------------

describe("gerarCronograma — dose de Ética (≥15%)", () => {
  it("gera blocos para a matéria de Ética", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosBase,
    });

    const blocosEtica = blocos.filter((b) => b.noId === ETICA_ID);
    expect(blocosEtica.length).toBeGreaterThan(0);
  });

  it("minutos de Ética representam parcela relevante do orçamento (≥15% com tolerância)", () => {
    const horas = 4;
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: horas,
      nos: nosBase,
    });

    const minEtica = blocos
      .filter((b) => b.noId === ETICA_ID)
      .reduce((s, b) => s + b.minutosAlvo, 0);

    const N = new Set(blocos.map((b) => b.dataAlvo)).size;
    const orcamentoTotal = N * horas * 60;
    const piso15Percent = 0.15 * orcamentoTotal;

    expect(minEtica).toBeGreaterThan(piso15Percent * 0.5);
  });
});

// ---------------------------------------------------------------------------
// Testes de tipos de blocos
// ---------------------------------------------------------------------------

describe("gerarCronograma — tipos de blocos", () => {
  it("gera blocos dos tipos 'conteudo' e 'questoes'", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosBase,
    });

    const tipos = new Set(blocos.map((b) => b.tipo));
    expect(tipos.has("conteudo")).toBe(true);
    expect(tipos.has("questoes")).toBe(true);
  });

  it("gera blocos de revisão para nós com erros recentes", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosBase,
      recentErros: [{ noId: CIVIL_ID, multiplicador: 1.2 }],
    });

    const revisoes = blocos.filter((b) => b.tipo === "revisao");
    expect(revisoes.length).toBeGreaterThan(0);
    expect(revisoes.every((b) => b.noId === CIVIL_ID)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Testes de cold-start
// ---------------------------------------------------------------------------

describe("gerarCronograma — cold-start (sem histórico)", () => {
  const nosSemHistorico: NoDiagnostico[] = [
    { noId: "a", noNome: "Direito Civil", eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 6, volumeOk: false },
    { noId: "b", noNome: "Direito Penal", eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 4, volumeOk: false },
    { noId: "c", noNome: "Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina", eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 8, volumeOk: false },
  ];

  it("funciona com banco vazio (nFeitas=0 para todos)", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosSemHistorico,
    });

    expect(blocos.length).toBeGreaterThan(0);
  });

  it("ordena por incidência pura no cold-start (maior incidência = mais minutos)", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosSemHistorico,
    });

    const minCivil = blocos.filter((b) => b.noId === "a").reduce((s, b) => s + b.minutosAlvo, 0);
    const minPenal = blocos.filter((b) => b.noId === "b").reduce((s, b) => s + b.minutosAlvo, 0);

    // Civil (incidência 6) >= Penal (incidência 4)
    expect(minCivil).toBeGreaterThanOrEqual(minPenal);
  });

  it("no cold-start, a matéria de maior incidência (Ética/Estatuto) lidera o calendário", () => {
    const blocos = ordenarComoDB(
      gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosSemHistorico })
    );
    expect(blocos[0].noId).toBe("c"); // Estatuto/Ética, incidência 8
  });
});

// ---------------------------------------------------------------------------
// Testes de campos obrigatórios
// ---------------------------------------------------------------------------

describe("gerarCronograma — estrutura dos blocos", () => {
  it("todos os blocos têm campos obrigatórios preenchidos", () => {
    const blocos = gerarCronograma({
      hoje: HOJE,
      dataProva: PROVA,
      horasPorDia: 4,
      nos: nosBase,
    });

    for (const b of blocos) {
      expect(typeof b.dataAlvo).toBe("string");
      expect(b.dataAlvo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof b.noId).toBe("string");
      expect(b.noId.length).toBeGreaterThan(0);
      expect(typeof b.eixo).toBe("string");
      expect(["conteudo", "questoes", "revisao"]).toContain(b.tipo);
      expect(b.minutosAlvo).toBeGreaterThan(0);
      expect(typeof b.ordem).toBe("number");
      expect(b.ordem).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Drop 2.5 — subtema granular + loop de desempenho
// ---------------------------------------------------------------------------

// IDs de subtema para fixtures
const SUB_HONORARIOS_ID   = "sub-0000-0000-0000-000000000001";
const SUB_INFRACTIONS_ID  = "sub-0000-0000-0000-000000000002";
const SUB_POSSE_ID        = "sub-0000-0000-0000-000000000003";
const SUB_CONTRATO_ID     = "sub-0000-0000-0000-000000000004";
const MAT_FALLBACK_ID     = "mat-0000-0000-0000-0000000000b1";

// ---------------------------------------------------------------------------
// nomeEhEtica — helper exportado
// ---------------------------------------------------------------------------

describe("nomeEhEtica — helper Drop 2.5", () => {
  it("detecta nomes que contêm 'ética'", () => {
    expect(nomeEhEtica("Ética e Estatuto da OAB")).toBe(true);
    expect(nomeEhEtica("ética profissional")).toBe(true);
  });

  it("detecta 'estatuto.*oab' (insensível a maiúsculas)", () => {
    expect(nomeEhEtica("Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina")).toBe(true);
    expect(nomeEhEtica("Estatuto OAB")).toBe(true);
  });

  it("detecta 'direitos humanos'", () => {
    expect(nomeEhEtica("Direitos Humanos")).toBe(true);
  });

  it("detecta 'filosofia do direito'", () => {
    expect(nomeEhEtica("Filosofia do Direito")).toBe(true);
  });

  it("não detecta nomes de subtemas de Ética (subtema por si só)", () => {
    // Subtemas como "Honorários" ou "Infração disciplinar" NÃO casam — é aí que eEtica entra
    expect(nomeEhEtica("Honorários advocatícios")).toBe(false);
    expect(nomeEhEtica("Infração disciplinar")).toBe(false);
    expect(nomeEhEtica("Sociedade de advogados")).toBe(false);
  });

  it("não detecta matérias comuns", () => {
    expect(nomeEhEtica("Cumprimento de sentença")).toBe(false);
    expect(nomeEhEtica("Direito Civil")).toBe(false);
    expect(nomeEhEtica("Direito Penal")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cold-start com nós de subtema
// ---------------------------------------------------------------------------

describe("gerarCronograma — Drop 2.5 cold-start subtema", () => {
  // Subtemas de Ética (eEtica=true via matéria-pai) e demais
  const nosSubtema: NoDiagnostico[] = [
    // Subtemas de Ética (matéria-pai = Ética)
    { noId: SUB_HONORARIOS_ID,  noNome: "Honorários advocatícios", eixo: "subtema", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 8,  volumeOk: false, eEtica: true },
    { noId: SUB_INFRACTIONS_ID, noNome: "Infrações disciplinares", eixo: "subtema", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 6,  volumeOk: false, eEtica: true },
    // Subtemas comuns
    { noId: SUB_POSSE_ID,       noNome: "Posse e propriedade",     eixo: "subtema", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 10, volumeOk: false, eEtica: false },
    { noId: SUB_CONTRATO_ID,    noNome: "Contratos em geral",      eixo: "subtema", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 7,  volumeOk: false, eEtica: false },
  ];

  it("cold-start subtema: nós ordenados por incidência DESC (Posse=10 antes de Contratos=7)", () => {
    const blocos = ordenarComoDB(
      gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosSubtema })
    );
    const idxPosse    = blocos.findIndex((b) => b.noId === SUB_POSSE_ID);
    const idxContrato = blocos.findIndex((b) => b.noId === SUB_CONTRATO_ID);
    // Posse (incidência 10) deve aparecer antes de Contratos (7) — EXCETO quando Ética lida
    expect(idxPosse).toBeLessThan(idxContrato);
  });

  it("Ética por flag: subtemas com eEtica=true recebem blocos (dose de Ética)", () => {
    const blocos = gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosSubtema });
    const blocosHonorarios = blocos.filter((b) => b.noId === SUB_HONORARIOS_ID);
    const blocosInfracoes  = blocos.filter((b) => b.noId === SUB_INFRACTIONS_ID);
    expect(blocosHonorarios.length).toBeGreaterThan(0);
    expect(blocosInfracoes.length).toBeGreaterThan(0);
  });

  it("subtema com eEtica=false NÃO cai no pool de Ética (nome não casa ETICA_RE)", () => {
    // Sem a flag eEtica, "Honorários advocatícios" NÃO seria detectado como Ética.
    // Usando nós sem flag: verificamos que subtemas sem flag e sem nome-ética são agendados normalmente.
    const nosSubtemaSemFlag: NoDiagnostico[] = [
      { noId: SUB_HONORARIOS_ID, noNome: "Honorários advocatícios", eixo: "subtema", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 8,  volumeOk: false /* sem eEtica */ },
      { noId: SUB_POSSE_ID,      noNome: "Posse e propriedade",     eixo: "subtema", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 10, volumeOk: false /* sem eEtica */ },
    ];
    const blocos = gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosSubtemaSemFlag });
    const minHonorarios = blocos.filter((b) => b.noId === SUB_HONORARIOS_ID).reduce((s, b) => s + b.minutosAlvo, 0);
    const minPosse      = blocos.filter((b) => b.noId === SUB_POSSE_ID).reduce((s, b) => s + b.minutosAlvo, 0);
    // Sem flag, ambos competem normalmente (nenhum recebe a "dose de Ética" garantida)
    // Posse (incidência 10) deve ter mais minutos que Honorários (8)
    expect(minPosse).toBeGreaterThanOrEqual(minHonorarios);
  });
});

// ---------------------------------------------------------------------------
// Backward-compat: matéria por nome (sem eEtica) ainda cai em Ética
// ---------------------------------------------------------------------------

describe("gerarCronograma — Drop 2.5 backward-compat matéria Ética por nome", () => {
  const nosMateria: NoDiagnostico[] = [
    { noId: ETICA_ID, noNome: "Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina", eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 8, volumeOk: false },
    { noId: CIVIL_ID, noNome: "Direito Civil", eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 6, volumeOk: false },
  ];

  it("matéria de Ética SEM flag eEtica ainda recebe dose de Ética via ETICA_RE (nome)", () => {
    const blocos = gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosMateria });
    const minEtica = blocos.filter((b) => b.noId === ETICA_ID).reduce((s, b) => s + b.minutosAlvo, 0);
    const N = new Set(blocos.map((b) => b.dataAlvo)).size;
    const orcamentoTotal = N * 4 * 60;
    // Ética ainda recebe pelo menos alguma proporção relevante (regressão)
    expect(minEtica).toBeGreaterThan(orcamentoTotal * 0.05);
  });
});

// ---------------------------------------------------------------------------
// Warm subtema: fraqueza re-prioriza acima de cold-start
// ---------------------------------------------------------------------------

describe("gerarCronograma — Drop 2.5 warm subtema (fraqueza re-prioriza)", () => {
  it("subtema com nFeitas>=8 e taxa baixa recebe MAIS minutos que subtema de mesma incidência e taxa alta", () => {
    const SUB_FRACO_ID = "sub-0000-0000-0000-000000000010";
    const SUB_FORTE_ID = "sub-0000-0000-0000-000000000011";

    const nosWarm: NoDiagnostico[] = [
      // Fraco: muitas questões feitas, taxa ruim → weaknessScore alto
      { noId: SUB_FRACO_ID, noNome: "Subtema Fraco", eixo: "subtema", nFeitas: 20, nAcertos: 5, taxa: 0.25, pesoIncidencia: 6, volumeOk: true, eEtica: false },
      // Forte: mesma incidência, taxa boa → weaknessScore baixo
      { noId: SUB_FORTE_ID, noNome: "Subtema Forte", eixo: "subtema", nFeitas: 20, nAcertos: 17, taxa: 0.85, pesoIncidencia: 6, volumeOk: true, eEtica: false },
    ];

    const blocos = gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosWarm });
    const minFraco = blocos.filter((b) => b.noId === SUB_FRACO_ID).reduce((s, b) => s + b.minutosAlvo, 0);
    const minForte = blocos.filter((b) => b.noId === SUB_FORTE_ID).reduce((s, b) => s + b.minutosAlvo, 0);

    // Fraqueza comprovada → mais minutos alocados (re-priorização)
    expect(minFraco).toBeGreaterThan(minForte);
  });
});

// ---------------------------------------------------------------------------
// Mix eixo: subtemas + matérias-fallback preservam eixo correto
// ---------------------------------------------------------------------------

describe("gerarCronograma — Drop 2.5 mix eixo subtema+materia", () => {
  it("cada bloco preserva o eixo do nó que o originou", () => {
    const nosMix: NoDiagnostico[] = [
      { noId: SUB_POSSE_ID,    noNome: "Posse e propriedade", eixo: "subtema", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 10, volumeOk: false, eEtica: false },
      { noId: MAT_FALLBACK_ID, noNome: "Direito Tributário",  eixo: "materia", nFeitas: 0, nAcertos: 0, taxa: 0, pesoIncidencia: 5,  volumeOk: false, eEtica: false },
    ];
    const blocos = gerarCronograma({ hoje: HOJE, dataProva: PROVA, horasPorDia: 4, nos: nosMix });

    // Blocos de subtema: eixo="subtema"; blocos de matéria: eixo="materia"
    for (const b of blocos.filter((b) => b.noId === SUB_POSSE_ID)) {
      expect(b.eixo).toBe("subtema");
    }
    for (const b of blocos.filter((b) => b.noId === MAT_FALLBACK_ID)) {
      expect(b.eixo).toBe("materia");
    }
  });
});
