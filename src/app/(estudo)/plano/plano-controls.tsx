"use client";

// Controles do Planner — client component
// AC-1.6.1: input de horas (decimal, default 3)
// AC-1.6.9: botão "Gerar novo plano" — regenera com horas atualizadas

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { gerarPlanoDiario } from "@/app/(estudo)/_actions/planner.actions";
import type { PlanoDiario, ItemPlano } from "@/lib/types/domain";

interface PlanoControlsProps {
  planoInicial: PlanoDiario | null;
}

// Etiquetas dos motivos (rastreáveis ao dado — AC-1.6.8 anti-chute)
const MOTIVO_LABEL: Record<ItemPlano["motivo"], string> = {
  reforco: "fraqueza + incidência",
  etica: "alto ROI — conteúdo fechado",
  medir: "explorar — amostra insuficiente (< 8 questões)",
  espacado: "repetição espaçada — erro recente",
};

const MOTIVO_COR: Record<ItemPlano["motivo"], string> = {
  reforco: "bg-red-50 text-red-700 border-red-200",
  etica: "bg-amber-50 text-amber-700 border-amber-200",
  medir: "bg-blue-50 text-blue-700 border-blue-200",
  espacado: "bg-purple-50 text-purple-700 border-purple-200",
};

function abreviaNome(nome: string): string {
  // Abrevia nomes longos como "Estatuto da Advocacia..." → "Ética (Estatuto OAB)"
  if (nome.toLowerCase().includes("estatuto da advocacia")) return "Ética / Estatuto OAB";
  if (nome.toLowerCase().includes("processual civil")) return "Dir. Processual Civil";
  if (nome.toLowerCase().includes("processual penal")) return "Dir. Processual Penal";
  if (nome.toLowerCase().includes("processual do trabalho")) return "Dir. Proc. Trabalho";
  if (nome.toLowerCase().includes("constitucional")) return "Dir. Constitucional";
  if (nome.toLowerCase().includes("administrativo")) return "Dir. Administrativo";
  if (nome.toLowerCase().includes("tributário")) return "Dir. Tributário";
  if (nome.toLowerCase().includes("empresarial")) return "Dir. Empresarial";
  if (nome.toLowerCase().includes("do trabalho")) return "Dir. do Trabalho";
  if (nome.toLowerCase().includes("consumidor")) return "Dir. do Consumidor";
  if (nome.toLowerCase().includes("ambiental")) return "Dir. Ambiental";
  if (nome.toLowerCase().includes("previdenciário")) return "Dir. Previdenciário";
  if (nome.toLowerCase().includes("eleitoral")) return "Dir. Eleitoral";
  if (nome.toLowerCase().includes("financeiro")) return "Dir. Financeiro";
  if (nome.toLowerCase().includes("humanos")) return "Direitos Humanos";
  if (nome.toLowerCase().includes("internacional")) return "Dir. Internacional";
  if (nome.toLowerCase().includes("filosof")) return "Filosofia do Direito";
  if (nome.toLowerCase().includes("eca") || nome.toLowerCase().includes("criança")) return "ECA";
  return nome.length > 30 ? nome.slice(0, 28) + "…" : nome;
}

function formatarHorasLabel(h: number): string {
  if (h === Math.floor(h)) return `${h}h`;
  const min = Math.round((h % 1) * 60);
  return `${Math.floor(h)}h${min}min`;
}

function ExplicacaoPlano({ plano }: { plano: PlanoDiario }) {
  const [expandido, setExpandido] = useState(false);
  const hora = formatarHorasLabel(plano.horas);

  // Ordena por número de questões (maior primeiro), com etica fixo no início
  const distribOrdenada = [...plano.distribuicao].sort((a, b) => {
    if (a.motivo === "etica") return -1;
    if (b.motivo === "etica") return 1;
    return b.n - a.n;
  });

  return (
    <div className="mt-6 space-y-4">
      {/* Resumo principal — AC-1.6.6 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500 mb-1">Plano de hoje</p>
        <p className="text-xl font-bold text-gray-900">
          {hora} — {plano.questoesAlvo} questões
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Gerado em {new Date(plano.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Lista por matéria — AC-1.6.6 */}
      <div className="space-y-2">
        {distribOrdenada.map((item, i) => (
          <div
            key={i}
            className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-900 text-sm">
                {abreviaNome(item.materia)}
              </span>
              {expandido && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Motivo: {MOTIVO_LABEL[item.motivo]}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${MOTIVO_COR[item.motivo]}`}
              >
                {item.motivo === "etica"
                  ? "Ética"
                  : item.motivo === "medir"
                  ? "medir"
                  : item.motivo === "espacado"
                  ? "espaçado"
                  : "reforço"}
              </span>
              <span className="text-base font-bold text-gray-900 w-8 text-right">
                {item.n}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* AC-1.6.8: explicação dos pesos (modo expandível — transparência anti-chute) */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
      >
        {expandido ? "Ocultar justificativas" : "Por que essas matérias? (ver justificativa)"}
      </button>

      {expandido && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-700 mb-2">Legenda dos motivos:</p>
          <p><span className="font-medium">reforço</span> — matéria com amostra ≥ 8 questões; score = incidência FGV × fraqueza (1 − taxa de acerto) × confiança do volume.</p>
          <p><span className="font-medium">medir</span> — amostra &lt; 8 questões; não há dado suficiente para declarar fraqueza. Peso por incidência pura (anti-chute §4).</p>
          <p><span className="font-medium">espaçado</span> — matéria com erros nas últimas 2 sessões; peso aumentado em +20% para repetição espaçada.</p>
          <p><span className="font-medium">Ética</span> — dose mínima garantida (≥ 10% do dia ou {">"}= 8 questões). ROI alto: conteúdo fechado, peso fixo da prova.</p>
        </div>
      )}
    </div>
  );
}

export function PlanoControls({ planoInicial }: PlanoControlsProps) {
  const [plano, setPlano] = useState<PlanoDiario | null>(planoInicial);
  const [horas, setHoras] = useState<number>(3);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);

    startTransition(async () => {
      const resultado = await gerarPlanoDiario(horas);
      if (resultado.ok) {
        setPlano(resultado.plano);
      } else {
        setErro(resultado.erro);
      }
    });
  }

  return (
    <div>
      {/* Formulário de horas — AC-1.6.1 */}
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="horas"
            className="text-sm font-medium text-gray-700"
          >
            Horas disponíveis hoje
          </label>
          <input
            id="horas"
            type="number"
            min={0.5}
            max={12}
            step={0.5}
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value))}
            className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          size="default"
        >
          {isPending
            ? "Gerando…"
            : plano
            ? "Gerar novo plano"
            : "Gerar plano do dia"}
        </Button>
      </form>

      {/* Erro */}
      {erro && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

      {/* Plano gerado ou carregado */}
      {plano && !isPending && <ExplicacaoPlano plano={plano} />}

      {/* Estado de loading */}
      {isPending && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-400 text-sm">
          Calculando distribuição…
        </div>
      )}
    </div>
  );
}
