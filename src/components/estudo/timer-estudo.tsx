"use client";

// Timer de estudo — client component.
// Reusa registrarEstudo (já aceita inicio/fim). Zero migration nova.
//
// Props:
//   materiaId / materiaNome — matéria que está sendo estudada (obrigatório)
//   subtemaId?              — subtema (opcional)
//   tipoEstudo?             — padrão 'leitura'
//   blocoId?                — se amarrado a um bloco do cronograma
//   minutosAlvo?            — para mostrar progresso (bloco amarrado)
//   onLogged?               — callback após sessão registrada (ex.: refresh do saldo)
//
// Trust boundary: o servidor RECOMPUTA duracao_min de (fim − inicio).
// O cliente passa minutos como fallback de validação Zod; o server sobrescreve.

import { useEffect, useState, useTransition } from "react";
import { useTimerStore } from "@/lib/stores/timer-store";
import { registrarEstudo } from "@/app/(estudo)/_actions/estudo.actions";
import { marcarBlocoFeito } from "@/app/(estudo)/_actions/cronograma.actions";
import type { TipoEstudo } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface TimerEstudoProps {
  materiaId: string;
  materiaNome: string;
  subtemaId?: string;
  materialId?: string;      // Fatia B: associar sessao a um material
  tipoEstudo?: TipoEstudo;
  blocoId?: string;
  minutosAlvo?: number;
  onLogged?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatarTempo(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function TimerEstudo({
  materiaId,
  materiaNome,
  subtemaId,
  materialId,
  tipoEstudo = "leitura",
  blocoId,
  minutosAlvo,
  onLogged,
}: TimerEstudoProps) {
  const { iniciarTimer, pararTimer, resetarTimer, startedAt, materiaId: timerMateriaId } = useTimerStore();
  const [elapsed, setElapsed] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Determina se ESTE timer (para esta matéria/bloco) está rodando.
  // Só 1 timer por vez: outro bloco mostra como "ocioso" mesmo que o store tenha startedAt.
  const esteRodando = startedAt !== null && timerMateriaId === materiaId;
  const outroRodando = startedAt !== null && timerMateriaId !== materiaId;

  // Atualiza elapsed via interval callback (não síncrono no body — evita lint purity).
  // elapsed é estático (stale) quando esteRodando=false, mas nunca exibido nesse estado.
  useEffect(() => {
    if (!esteRodando || !startedAt) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [esteRodando, startedAt]);

  // -------------------------------------------------------------------------
  // Iniciar timer
  // -------------------------------------------------------------------------
  async function handleIniciar() {
    setAviso(null);

    // Se outro timer está rodando, pede para parar antes
    if (outroRodando) {
      setAviso("Pare o timer atual antes de iniciar outro.");
      return;
    }

    iniciarTimer({ materiaId, subtemaId: subtemaId ?? null, blocoId: blocoId ?? null });

    // Se amarrado a um bloco, marca como em_andamento ao iniciar
    if (blocoId) {
      startTransition(async () => {
        await marcarBlocoFeito(blocoId, "em_andamento");
      });
    }
  }

  // -------------------------------------------------------------------------
  // Parar timer
  // -------------------------------------------------------------------------
  async function handleParar() {
    const snap = pararTimer();
    if (!snap) return;

    const { startedAt: inicio, materiaId: mId, subtemaId: sId, blocoId: bId } = snap;
    const agora = Date.now();
    // Minutos do lado do cliente (fallback para Zod; servidor recomputa de inicio/fim)
    const minutosCliente = Math.round((agora - inicio) / 60000);

    if (minutosCliente < 1) {
      setAviso("Sessão muito curta (< 1 min) — não registrada.");
      return;
    }

    startTransition(async () => {
      const resultado = await registrarEstudo({
        materiaId: mId,
        subtemaId: sId ?? undefined,
        materialId: materialId,   // Fatia B: material associado
        tipoEstudo,
        minutos: minutosCliente,  // servidor recomputa se inicio+fim presentes
        inicio: new Date(inicio).toISOString(),
        fim: new Date(agora).toISOString(),
      });

      if (!resultado.ok) {
        setAviso(`Erro ao registrar: ${resultado.erro}`);
        return;
      }

      // Se havia bloco, não auto-fecha (controle explícito da usuária — §5.1 AUTO-DECISION)
      void bId; // referência mantida mas não auto-fecha

      onLogged?.();
    });
  }

  // -------------------------------------------------------------------------
  // Progresso (se amarrado a um bloco com minutosAlvo)
  // Sugestao "feito" quando elapsed >= minutosAlvo (Fatia B)
  // -------------------------------------------------------------------------
  const elapsedMin = elapsed / 60000;
  const progressoPct = minutosAlvo && minutosAlvo > 0
    ? Math.min(100, Math.round((elapsedMin / minutosAlvo) * 100))
    : null;
  const metaAtingida = esteRodando && minutosAlvo && minutosAlvo > 0
    && elapsedMin >= minutosAlvo;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-2">
      {/* Timer display */}
      {esteRodando && (
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-semibold text-gray-900 tabular-nums">
            {formatarTempo(elapsed)}
          </span>
          {progressoPct !== null && (
            <span className="text-xs text-gray-500">
              {progressoPct}% de {minutosAlvo}min
            </span>
          )}
        </div>
      )}

      {/* Barra de progresso */}
      {esteRodando && progressoPct !== null && (
        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-1000"
            style={{ width: `${progressoPct}%` }}
          />
        </div>
      )}

      {/* Meta atingida — sugestao de parar (Fatia B) */}
      {metaAtingida && !aviso && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
          Meta atingida! Pare o timer e marque como feito quando terminar.
        </p>
      )}

      {/* Botões */}
      <div className="flex items-center gap-2">
        {!esteRodando ? (
          <button
            type="button"
            onClick={handleIniciar}
            disabled={isPending || outroRodando}
            title={outroRodando ? `Outro timer ativo (${timerMateriaId?.slice(0, 8)}…). Pare antes.` : `Iniciar timer — ${materiaNome}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-xs">▶</span>
            {outroRodando ? "Outro ativo" : "Iniciar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleParar}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            <span className="text-xs">■</span>
            {isPending ? "Registrando…" : "Parar"}
          </button>
        )}

        {esteRodando && (
          <button
            type="button"
            onClick={() => resetarTimer()}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Aviso */}
      {aviso && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {aviso}
        </p>
      )}
    </div>
  );
}
