// [RSC] Dashboard de diagnóstico
// Lê views de diagnóstico via Supabase (server) e passa dados para charts (client)
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import GraficoMaterias from "./grafico-materias";
import GraficoEvolucao from "./grafico-evolucao";
import CountdownWidget from "./countdown";

// Data da prova OAB 1ª fase
const PROVA_DATE = "2026-09-06";

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const diasRestantes = getDaysUntil(PROVA_DATE);

  // Dados para gráfico de matérias (diag_por_no — eixo matéria)
  const { data: diagMateria } = await supabase
    .from("diag_por_no")
    .select("no_id, no_nome, n_feitas, n_acertos, taxa, amostra_suficiente")
    .eq("user_id", user.id)
    .eq("eixo", "materia")
    .order("taxa", { ascending: true });

  // Dados temporais: busca sessões com resultado para evolução
  const { data: sessoesData } = await supabase
    .from("sessoes")
    .select("id, inicio, fim")
    .eq("user_id", user.id)
    .not("fim", "is", null)
    .order("inicio", { ascending: true })
    .limit(20);

  // Para cada sessão, busca acertos
  type SessaoEvolucao = {
    data: string;
    taxa: number;
    total: number;
    acertos: number;
  };

  const evolucao: SessaoEvolucao[] = [];

  for (const s of sessoesData ?? []) {
    const { data: res } = await supabase
      .from("respostas")
      .select("correta")
      .eq("sessao_id", s.id)
      .not("correta", "is", null);

    if (!res || res.length === 0) continue;
    const acertos = res.filter((r) => r.correta).length;
    evolucao.push({
      data: s.inicio.slice(0, 10),
      taxa: Math.round((acertos / res.length) * 100),
      total: res.length,
      acertos,
    });
  }

  // Última sessão
  const { data: ultimaSessao } = await supabase
    .from("sessoes")
    .select("id, inicio, exame_id")
    .eq("user_id", user.id)
    .not("fim", "is", null)
    .order("inicio", { ascending: false })
    .limit(1)
    .single();

  let ultimaSessaoInfo: { data: string; acertos: number; total: number; sessaoId: string } | null = null;

  if (ultimaSessao) {
    const { data: resUltima } = await supabase
      .from("respostas")
      .select("correta")
      .eq("sessao_id", ultimaSessao.id)
      .not("correta", "is", null);

    if (resUltima && resUltima.length > 0) {
      const acertos = resUltima.filter((r) => r.correta).length;
      ultimaSessaoInfo = {
        data: ultimaSessao.inicio.slice(0, 10),
        acertos,
        total: resUltima.length,
        sessaoId: ultimaSessao.id,
      };
    }
  }

  // Histórico total
  const { data: totalData } = await supabase
    .from("respostas")
    .select("correta")
    .eq("user_id", user.id)
    .not("correta", "is", null);

  const totalFeitas = totalData?.length ?? 0;
  const totalAcertos = totalData?.filter((r) => r.correta).length ?? 0;
  const taxaHistorica = totalFeitas > 0 ? Math.round((totalAcertos / totalFeitas) * 100) : 0;

  const totalSessoes = sessoesData?.length ?? 0;

  // Tendência geral (últimas 3 sessões)
  type Tendencia = "melhora" | "estabilidade" | "piora" | "sem_dados";
  let tendencia: Tendencia = "sem_dados";
  if (evolucao.length >= 3) {
    const ultimas3 = evolucao.slice(-3);
    const mediaIni = (ultimas3[0].taxa + ultimas3[1].taxa) / 2;
    const mediaFim = ultimas3[2].taxa;
    if (mediaFim - mediaIni > 3) tendencia = "melhora";
    else if (mediaIni - mediaFim > 3) tendencia = "piora";
    else tendencia = "estabilidade";
  }

  const materiasChart = (diagMateria ?? []).map((m) => ({
    nome: m.no_nome ?? "Desconhecida",
    taxa: Math.round((m.taxa ?? 0) * 100),
    n_feitas: m.n_feitas ?? 0,
    n_acertos: m.n_acertos ?? 0,
    amostra_suficiente: m.amostra_suficiente ?? false,
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Countdown hero (client) */}
      <CountdownWidget diasRestantes={diasRestantes} />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalFeitas}</div>
          <div className="text-xs text-gray-500 mt-1">Questões feitas</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{taxaHistorica}%</div>
          <div className="text-xs text-gray-500 mt-1">Taxa geral</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalSessoes}</div>
          <div className="text-xs text-gray-500 mt-1">Sessões</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {tendencia === "melhora" ? "▲" : tendencia === "piora" ? "▼" : tendencia === "estabilidade" ? "→" : "–"}
          </div>
          <div className={`text-xs mt-1 ${tendencia === "melhora" ? "text-green-600" : tendencia === "piora" ? "text-red-600" : "text-gray-500"}`}>
            {tendencia === "melhora" ? "Melhorando" : tendencia === "piora" ? "Piorando" : tendencia === "estabilidade" ? "Estável" : "Sem dados"}
          </div>
        </div>
      </div>

      {/* Última sessão */}
      {ultimaSessaoInfo && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Última sessão — {ultimaSessaoInfo.data}</p>
            <p className="text-sm text-blue-700">
              {ultimaSessaoInfo.acertos}/{ultimaSessaoInfo.total} acertos (
              {Math.round((ultimaSessaoInfo.acertos / ultimaSessaoInfo.total) * 100)}%)
            </p>
          </div>
          <a
            href={`/resultado/${ultimaSessaoInfo.sessaoId}`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver resultado →
          </a>
        </div>
      )}

      {/* Descoberta: link para o painel de incidência do corpus (Drop 4) */}
      <Link
        href="/incidencia"
        className="block bg-blue-50 rounded-xl border border-blue-200 p-4 mb-8 hover:bg-blue-100 transition-colors"
      >
        <p className="text-sm font-medium text-blue-900">
          Incidência &amp; tendência por subtema →
        </p>
        <p className="text-sm text-blue-700">
          O que a prova mais cobra, por subtema — fato do corpus (descritivo, não preditivo).
        </p>
      </Link>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {materiasChart.length > 0 ? (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Acerto por Matéria
            </h2>
            <GraficoMaterias materias={materiasChart} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-400">
            Complete provas para ver diagnóstico por matéria
          </div>
        )}

        {evolucao.length > 0 ? (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Evolução Temporal
            </h2>
            <GraficoEvolucao dados={evolucao} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-400">
            Complete provas para ver evolução temporal
          </div>
        )}
      </div>
    </div>
  );
}
