// [RSC] Progresso de Estudo — tempo por matéria (Fatia B)
// Lê v_tempo_por_no (eixo=materia) e exibe barras de tempo com Recharts.

import { createActionClient } from "@/lib/supabase/action";
import { GraficoTempoPorMateria } from "./grafico-tempo-por-materia";
import type { TempoPorNo } from "@/lib/types/domain";

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
// Page
// ---------------------------------------------------------------------------

function formatarMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

export default async function ProgressoPage() {
  const dados = await carregarTempoPorMateria();
  const totalMin = dados.reduce((s, d) => s + d.totalMin, 0);

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
    </div>
  );
}
