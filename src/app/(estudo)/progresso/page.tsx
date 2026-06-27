// [RSC] Progresso de Estudo — tempo por matéria (Fatia B) + Esforço × Resultado (Drop 2)
// Lê v_tempo_por_no (Fatia B) e v_esforco_resultado (Drop 2) e exibe os dados.

import { createActionClient } from "@/lib/supabase/action";
import { GraficoTempoPorMateria } from "./grafico-tempo-por-materia";
import type { TempoPorNo } from "@/lib/types/domain";
import { carregarEsforcoResultado } from "@/app/(estudo)/_actions/esforco.actions";
import type { EsforcoNo, QuadranteEsforco } from "@/lib/diagnostico/esforco";

// ---------------------------------------------------------------------------
// Fetch direto (RSC — sem Server Action wrapper pois é só leitura)
// ---------------------------------------------------------------------------

async function carregarTempoPorMateria(): Promise<TempoPorNo[]> {
  try {
    const client = await createActionClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return [];

    const { data, error } = await client
      .from("v_tempo_por_no")
      .select("user_id, eixo, no_id, no_nome, total_min, n_sessoes, ultimo_ts")
      .eq("user_id", user.id)
      .eq("eixo", "materia")
      .order("total_min", { ascending: false });

    if (error || !data) return [];

    return (data as Array<{
      user_id: string;
      eixo: string;
      no_id: string;
      no_nome: string;
      total_min: number;
      n_sessoes: number;
      ultimo_ts: string;
    }>).map((r) => ({
      userId:   r.user_id,
      eixo:     r.eixo as "materia",
      noId:     r.no_id,
      noNome:   r.no_nome,
      totalMin: r.total_min,
      nSessoes: r.n_sessoes,
      ultimoTs: r.ultimo_ts,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatarMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

// Linha de resumo de um nó dentro do card de quadrante
function linhaNo(no: EsforcoNo): string {
  return `${no.noNome} · ${Math.round(no.taxa * 100)}% · ${formatarMin(no.totalMin)} · ${no.nFeitas}q`;
}

// ---------------------------------------------------------------------------
// Configuração dos quadrantes — posição, cor, eixo e significado
// ---------------------------------------------------------------------------

interface ConfigQuadrante {
  quadrante: QuadranteEsforco;
  rotulo: string;
  significado: string;
  // Classes Tailwind de cor de fundo/borda/texto
  bg: string;
  border: string;
  badge: string;
}

const QUADRANTES: ConfigQuadrante[] = [
  // Linha 1 — tempo alto
  {
    quadrante: "esforco_sem_retorno",
    rotulo: "Esforço sem retorno",
    significado: "Muito tempo, resultado baixo — revisar método.",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
  },
  {
    quadrante: "dominado",
    rotulo: "Dominado",
    significado: "Muito tempo, resultado ótimo — matéria consolidada.",
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-800",
  },
  // Linha 2 — tempo baixo
  {
    quadrante: "subexposto",
    rotulo: "Subexposto",
    significado: "Pouco tempo, resultado baixo — aumentar exposição.",
    bg: "bg-gray-50",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-700",
  },
  {
    quadrante: "eficiente",
    rotulo: "Eficiente",
    significado: "Pouco tempo, resultado ótimo — aproveitar o ritmo.",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800",
  },
];

// ---------------------------------------------------------------------------
// Componente de card de quadrante (RSC — sem "use client")
// ---------------------------------------------------------------------------

function CardQuadrante({
  config,
  nos,
}: {
  config: ConfigQuadrante;
  nos: EsforcoNo[];
}) {
  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
          {config.rotulo}
        </span>
        <span className="text-xs text-gray-400">({nos.length})</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{config.significado}</p>
      {nos.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Nenhuma materia neste quadrante.</p>
      ) : (
        <ul className="space-y-1">
          {nos.map((no) => (
            <li key={no.noId} className="text-xs text-gray-700 leading-snug">
              {linhaNo(no)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProgressoPage() {
  // Carrega os dois conjuntos de dados em paralelo
  const [dados, esforcos] = await Promise.all([
    carregarTempoPorMateria(),
    carregarEsforcoResultado("materia"),
  ]);

  const totalMin = dados.reduce((s, d) => s + d.totalMin, 0);

  // Separa nós por quadrante para o grid
  const porQuadrante = (q: QuadranteEsforco) =>
    esforcos.filter((e) => e.quadrante === q);
  const medindo = esforcos.filter((e) => e.quadrante === "medindo");
  const comVeredito = esforcos.filter((e) => e.quadrante !== "medindo");

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Progresso de Estudo</h1>
        <p className="text-gray-500 text-sm mt-1">
          Tempo total registrado por materia. Cruzamento esforco x resultado (Drop 2).
        </p>
      </div>

      {dados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">Nenhuma sessao de estudo registrada ainda.</p>
          <p className="text-xs text-gray-400 mt-1">
            Use o Registro ou o Timer nos blocos do Plano para comecar a capturar dados.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumo */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total registrado</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{formatarMin(totalMin)}</p>
            <p className="text-xs text-gray-400 mt-0.5">em {dados.reduce((s, d) => s + d.nSessoes, 0)} sessoes · {dados.length} materia(s)</p>
          </div>

          {/* Grafico */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Tempo por materia</h2>
            <GraficoTempoPorMateria dados={dados} />
          </div>

          {/* Tabela */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Materia</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Tempo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Sessoes</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Ultima sessao</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((d, i) => (
                  <tr
                    key={d.noId}
                    className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {d.noNome.length > 50 ? d.noNome.slice(0, 48) + "…" : d.noNome}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatarMin(d.totalMin)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{d.nSessoes}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs hidden sm:table-cell">
                      {new Date(d.ultimoTs).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================
          SECAO: Esforço × Resultado (Drop 2)
          Anti-chute §4: veredito de quadrante APENAS para padraoConfiavel=true.
          Nós com "medindo" ficam em bloco separado, sem veredito.
          ================================================================ */}
      <div className="mt-10">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Esforco x Resultado</h2>
          <p className="text-sm text-gray-500 mt-1">
            Onde cada materia esta no espectro de esforco (tempo) e efetividade (taxa de acerto).
          </p>
        </div>

        {/* Empty state — sem dados ou tudo "medindo" */}
        {esforcos.length === 0 || comVeredito.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-gray-500 text-sm">
              Continue estudando e registrando tempo — os quadrantes aparecem quando houver
              volume (≥60min e ≥8 questoes por materia).
            </p>
          </div>
        ) : (
          <>
            {/* Legenda dos eixos */}
            <div className="mb-3 flex items-center gap-6 text-xs text-gray-400">
              <span>
                <span className="font-medium text-gray-600">Vertical:</span> Tempo (cima = muito tempo)
              </span>
              <span>
                <span className="font-medium text-gray-600">Horizontal:</span> Taxa de acerto (direita = boa)
              </span>
            </div>

            {/* Grid 2×2 de quadrantes */}
            <div className="grid grid-cols-2 gap-3">
              {QUADRANTES.map((cfg) => (
                <CardQuadrante
                  key={cfg.quadrante}
                  config={cfg}
                  nos={porQuadrante(cfg.quadrante)}
                />
              ))}
            </div>
          </>
        )}

        {/* Bloco "Ainda medindo" — sem veredito de quadrante (anti-chute §4) */}
        {medindo.length > 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              Ainda medindo ({medindo.length})
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Volume insuficiente (tempo &lt;60min ou &lt;8 questoes) — sem veredito ainda.
            </p>
            <ul className="space-y-1">
              {medindo.map((no) => (
                <li key={no.noId} className="text-xs text-gray-600">
                  {no.noNome}
                  {no.totalMin > 0 && ` · ${formatarMin(no.totalMin)}`}
                  {no.nFeitas > 0 && ` · ${no.nFeitas}q`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
