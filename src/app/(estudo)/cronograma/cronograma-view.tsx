"use client";

// Visualização do roteiro de estudo — Cockpit Drop 1.5, Fatia 1.
// Agrupa blocos por data_alvo e permite marcar como feito.

import { useTransition } from "react";
import Link from "next/link";
import { marcarBlocoFeito } from "@/app/(estudo)/_actions/cronograma.actions";
import type { CronogramaBloco, BlocoStatus } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Constantes de UI
// ---------------------------------------------------------------------------

const TIPO_LABEL: Record<string, string> = {
  conteudo: "Conteúdo",
  questoes: "Questões",
  revisao:  "Revisão",
};

const TIPO_COR: Record<string, string> = {
  conteudo: "bg-blue-50 text-blue-700 border-blue-200",
  questoes: "bg-purple-50 text-purple-700 border-purple-200",
  revisao:  "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_COR: Record<string, string> = {
  pendente:    "border-gray-200 bg-white",
  em_andamento: "border-yellow-200 bg-yellow-50",
  feito:       "border-green-200 bg-green-50",
};

// ---------------------------------------------------------------------------
// Bloco individual
// ---------------------------------------------------------------------------

interface BlocoCardProps {
  bloco: CronogramaBloco;
  onStatusChange: (id: string, status: BlocoStatus) => void;
}

function BlocoCard({ bloco, onStatusChange }: BlocoCardProps) {
  const [isPending, startTransition] = useTransition();
  const isFeito = bloco.status === "feito";

  function handleMarcar() {
    const novoStatus: BlocoStatus = isFeito ? "pendente" : "feito";
    startTransition(async () => {
      const result = await marcarBlocoFeito(bloco.id, novoStatus);
      if (result.ok) {
        onStatusChange(bloco.id, novoStatus);
      }
    });
  }

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 gap-3 ${STATUS_COR[bloco.status]}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Checkbox de marcar feito */}
        <button
          type="button"
          onClick={handleMarcar}
          disabled={isPending}
          aria-label={isFeito ? "Marcar como pendente" : "Marcar como feito"}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            isFeito
              ? "border-green-500 bg-green-500"
              : "border-gray-300 bg-white hover:border-blue-400"
          } ${isPending ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
        >
          {isFeito && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Conteúdo do bloco */}
        <div className="min-w-0">
          {bloco.subtemaNome ? (
            <>
              <p className="text-xs text-gray-400 truncate">{bloco.materiaNome ?? "Matéria"} ›</p>
              <p className={`text-sm font-medium truncate ${isFeito ? "line-through text-gray-400" : "text-gray-900"}`}>
                {bloco.subtemaNome}
              </p>
            </>
          ) : (
            <p className={`text-sm font-medium truncate ${isFeito ? "line-through text-gray-400" : "text-gray-900"}`}>
              {bloco.materiaNome ?? bloco.materiaId}
            </p>
          )}
          {/* Deep-link para treino filtrado por subtema (Drop 2.5) */}
          {bloco.tipo === "questoes" && bloco.subtemaId && (
            <Link
              href={`/treino?subtema=${bloco.subtemaId}`}
              className="inline-block mt-1 text-xs text-purple-700 underline underline-offset-2 hover:text-purple-900"
            >
              Treinar questões
            </Link>
          )}
        </div>
      </div>

      {/* Badges direita */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${TIPO_COR[bloco.tipo] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
          {TIPO_LABEL[bloco.tipo] ?? bloco.tipo}
        </span>
        <span className="text-xs font-bold text-gray-700 w-14 text-right">
          {bloco.minutosAlvo} min
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grupo de blocos por dia
// ---------------------------------------------------------------------------

interface DiaBlocos {
  data: string;
  blocos: CronogramaBloco[];
}

function formatarData(dataStr: string): string {
  const d = new Date(dataStr + "T00:00:00");
  const hoje = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  if (dataStr === hoje)   return "Hoje";
  if (dataStr === amanha) return "Amanhã";

  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function totalMinutos(blocos: CronogramaBloco[]): number {
  return blocos.reduce((s, b) => s + b.minutosAlvo, 0);
}

function totalFeitos(blocos: CronogramaBloco[]): number {
  return blocos.filter((b) => b.status === "feito").length;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface CronogramaViewProps {
  blocos: CronogramaBloco[];
  onStatusChange: (id: string, status: BlocoStatus) => void;
}

export function CronogramaView({ blocos, onStatusChange }: CronogramaViewProps) {
  if (blocos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-400 text-sm">
        Nenhum bloco de estudo agendado para esta semana.
        <br />
        Informe as horas disponíveis e gere o roteiro.
      </div>
    );
  }

  // Agrupa por data_alvo
  const porDia = new Map<string, CronogramaBloco[]>();
  for (const b of blocos) {
    const lista = porDia.get(b.dataAlvo) ?? [];
    lista.push(b);
    porDia.set(b.dataAlvo, lista);
  }

  const dias: DiaBlocos[] = Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, bs]) => ({
      data,
      blocos: [...bs].sort((a, b) => a.ordem - b.ordem),
    }));

  return (
    <div className="space-y-6 mt-4">
      {dias.map(({ data, blocos: bs }) => {
        const feitos = totalFeitos(bs);
        const total  = bs.length;
        const minTotal = totalMinutos(bs);

        return (
          <section key={data}>
            {/* Cabeçalho do dia */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                {formatarData(data)}
              </h3>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{minTotal} min</span>
                <span>
                  {feitos}/{total} feitos
                </span>
              </div>
            </div>

            {/* Barra de progresso do dia */}
            {total > 0 && (
              <div className="w-full h-1 rounded bg-gray-100 mb-3">
                <div
                  className="h-1 rounded bg-green-400 transition-all"
                  style={{ width: `${Math.round((feitos / total) * 100)}%` }}
                />
              </div>
            )}

            {/* Blocos do dia */}
            <div className="space-y-2">
              {bs.map((b) => (
                <BlocoCard
                  key={b.id}
                  bloco={b}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
