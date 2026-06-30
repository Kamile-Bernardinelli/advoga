// [RSC] Incidência & Tendência por subtema — painel DESCRITIVO (spec docs/architecture/
// trend-display-spec.md). Lê 2 views read-only SEM user_id (fato do corpus, aggregate-safe:
// sem gabarito/enunciado). Densifica os zeros na pure lib e normaliza global p/ mostrar a PLANURA.
// Regra-mãe (anti-chute §7): NUNCA sugerir previsão de "qual subtema vai cair".
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { montarRanking } from "@/lib/incidencia/tendencia";
import type { IncidenciaRow, TendenciaRow } from "@/lib/types/domain";
import { BannerHonestidade } from "./banner-honestidade";
import { SparklineEdicoes } from "./sparkline-edicoes";
import GraficoIncidencia from "./grafico-incidencia";

const TOP_GRAFICO = 15; // headline (recharts)
const TOP_TABELA = 40; // tabela detalhada (de ~158 subtemas cobrados)

export default async function IncidenciaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // (a) Ranking cumulativo — 1 linha por subtema (~158 linhas). SEM .eq("user_id") — fato do corpus.
  const { data: incid } = await supabase
    .from("v_incidencia_subtema")
    .select("subtema_id, subtema_nome, materia_id, materia_nome, n_questoes, n_disponiveis")
    .order("n_questoes", { ascending: false });

  // (b) Série temporal — 1 linha por (subtema × edição), SÓ células não-zero (~551 linhas).
  const { data: tend } = await supabase
    .from("v_tendencia_subtema")
    .select("subtema_id, exame_numero, ano, n_questoes")
    .order("exame_numero", { ascending: true });

  // Densifica zeros + monta o view-model (pure lib testável).
  const { edicoes, maxSerie, linhas } = montarRanking(
    (incid ?? []) as IncidenciaRow[],
    (tend ?? []) as TendenciaRow[],
  );

  const totalQuestoes = linhas.reduce((s, l) => s + l.incidencia, 0);
  const maxIncid = linhas.length > 0 ? linhas[0].incidencia : 0; // já ordenado desc
  const edMin = edicoes[0] ?? 0;
  const edMax = edicoes[edicoes.length - 1] ?? 0;

  const topGrafico = linhas.slice(0, TOP_GRAFICO).map((l) => ({
    subtemaNome: l.subtemaNome,
    materiaNome: l.materiaNome,
    incidencia: l.incidencia,
    disponiveis: l.disponiveis,
  }));
  const topTabela = linhas.slice(0, TOP_TABELA);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Incidência &amp; tendência por subtema</h1>
      <p className="text-sm text-muted-foreground mb-6">
        O que a prova já cobrou, por subtema — e a estabilidade disso ao longo das edições.
      </p>

      {/* Banner honesto — acima dos dados, não-dismissível (anti-chute §7) */}
      <BannerHonestidade edMin={edMin} edMax={edMax} />

      {linhas.length === 0 ? (
        <div className="bg-card rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
          Sem dados de incidência disponíveis no momento.
        </div>
      ) : (
        <>
          {/* 4 cards de resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{linhas.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Subtemas cobrados</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{totalQuestoes}</div>
              <div className="text-xs text-muted-foreground mt-1">Questões na janela</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{edicoes.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Edições</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-muted-foreground">→</div>
              <div className="text-xs text-muted-foreground mt-1">Estável</div>
            </div>
          </div>

          {/* Headline recharts — top-15 por incidência */}
          <div className="mb-8">
            <h2 className="text-base font-semibold text-foreground mb-3">
              Top {TOP_GRAFICO} por incidência
            </h2>
            <GraficoIncidencia dados={topGrafico} />
          </div>

          {/* Ranking por subtema — tabela top-40 com sparkline densificada */}
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">Ranking por subtema</h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="text-right px-3 py-3 font-medium text-muted-foreground w-10">#</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Subtema</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground w-40">Incidência</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                      Por edição
                    </th>
                    <th className="text-right px-3 py-3 font-medium text-muted-foreground hidden md:table-cell">
                      Respondíveis
                    </th>
                    <th className="text-right px-3 py-3 font-medium text-muted-foreground w-20">Treinar</th>
                  </tr>
                </thead>
                <tbody>
                  {topTabela.map((l, i) => {
                    const pct = maxIncid > 0 ? (l.incidencia / maxIncid) * 100 : 0;
                    return (
                      <tr
                        key={l.subtemaId}
                        className={`border-b border-border ${i % 2 === 0 ? "bg-card" : "bg-muted/50"}`}
                      >
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-3">
                          <div
                            className="text-foreground font-medium leading-snug"
                            title={l.subtemaNome}
                          >
                            {l.subtemaNome.length > 56
                              ? l.subtemaNome.slice(0, 54) + "…"
                              : l.subtemaNome}
                          </div>
                          <div className="text-xs text-muted-foreground">{l.materiaNome} ›</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2 min-w-12">
                              <div
                                className="bg-muted-foreground/40 h-2 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-foreground w-6 text-right">
                              {l.incidencia}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <SparklineEdicoes serie={l.serie} edicoes={edicoes} max={maxSerie} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                          {l.disponiveis}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {l.disponiveis > 0 ? (
                            <Link
                              href={`/treino?subtema=${l.subtemaId}`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium"
                            >
                              Treinar
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando os {Math.min(TOP_TABELA, linhas.length)} de maior incidência de{" "}
              {linhas.length} subtemas cobrados. Variação por edição está dentro do ruído
              estatístico (ver banner).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
