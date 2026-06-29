// Densificação da série esparsa de v_tendencia_subtema + montagem do ranking.
// PURO, testável sem DB (segue a convenção de src/lib/diagnostico/*).
// Fato do corpus — NENHUM juízo de tendência/previsão aqui (ver docs/analysis/
// tendencia-subtema-findings.md §4: o movimento observado é igual ou menor que o acaso).

import type { IncidenciaRow, TendenciaRow, SubtemaTendencia } from "@/lib/types/domain";

/** Eixo temporal = edições realmente presentes no corpus, ordenadas asc. */
export function eixoEdicoes(tend: TendenciaRow[]): number[] {
  return [...new Set(tend.map((t) => t.exame_numero ?? 0))]
    .filter((e) => e > 0)
    .sort((a, b) => a - b);
}

/** Reintroduz os ZEROS: para cada edição do eixo, usa a contagem ou 0. */
export function densificarSerie(porEdicao: Map<number, number>, edicoes: number[]): number[] {
  return edicoes.map((ed) => porEdicao.get(ed) ?? 0);
}

export interface RankingTendencia {
  edicoes: number[];          // eixo x (edições presentes)
  maxSerie: number;           // máx GLOBAL de células (normaliza sparklines p/ comparabilidade)
  linhas: SubtemaTendencia[]; // ordenadas por incidência desc
}

export function montarRanking(incid: IncidenciaRow[], tend: TendenciaRow[]): RankingTendencia {
  const edicoes = eixoEdicoes(tend);

  // Agrupa série por subtema → Map<edicao, n>
  const porSubtema = new Map<string, Map<number, number>>();
  for (const t of tend) {
    if (!t.subtema_id || !t.exame_numero) continue;
    const m = porSubtema.get(t.subtema_id) ?? new Map<number, number>();
    m.set(t.exame_numero, t.n_questoes ?? 0);
    porSubtema.set(t.subtema_id, m);
  }

  const linhas: SubtemaTendencia[] = incid
    .filter((i) => i.subtema_id)
    .map((i) => ({
      subtemaId: i.subtema_id as string,
      subtemaNome: i.subtema_nome ?? "—",
      materiaNome: i.materia_nome ?? "—",
      incidencia: i.n_questoes ?? 0,
      disponiveis: i.n_disponiveis ?? 0,
      serie: densificarSerie(porSubtema.get(i.subtema_id as string) ?? new Map(), edicoes),
    }))
    .sort((a, b) => b.incidencia - a.incidencia);

  // máx GLOBAL. Normaliza TODAS as sparklines pela mesma escala → contagem 1 tem a mesma
  // altura em qualquer linha → o olho enxerga a PLANURA (anti-chute). NÃO trocar por per-linha.
  const maxSerie = Math.max(1, ...linhas.flatMap((l) => l.serie));

  return { edicoes, maxSerie, linhas };
}
