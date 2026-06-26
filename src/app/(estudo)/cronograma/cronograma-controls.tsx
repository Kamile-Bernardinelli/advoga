"use client";

// Controles do Cronograma — Cockpit Drop 1.5, Fatia 1.
// Input de horas/dia + botão gerar/regenerar.
// Espelha o padrão de plano-controls.tsx.

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { gerarCronograma } from "@/app/(estudo)/_actions/cronograma.actions";
import { definirMetaBase } from "@/app/(estudo)/_actions/metas.actions";
import { CronogramaView } from "./cronograma-view";
import type { CronogramaBloco, BlocoStatus } from "@/lib/types/domain";

interface CronogramaControlsProps {
  blocosIniciais: CronogramaBloco[];
}

export function CronogramaControls({ blocosIniciais }: CronogramaControlsProps) {
  const [blocos, setBlocos]       = useState<CronogramaBloco[]>(blocosIniciais);
  const [horas, setHoras]         = useState<number>(4);
  const [erro, setErro]           = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Atualiza o status de um bloco localmente (otimistic UI)
  const handleStatusChange = useCallback((id: string, status: BlocoStatus) => {
    setBlocos((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b))
    );
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);

    startTransition(async () => {
      // §5.3: persiste a meta base antes de gerar (fonte única de orçamento)
      await definirMetaBase(Math.round(horas * 60));
      const resultado = await gerarCronograma(horas);
      if (resultado.ok) {
        setBlocos(resultado.blocos);
      } else {
        setErro(resultado.erro);
      }
    });
  }

  const temBlocos = blocos.length > 0;

  return (
    <div>
      {/* Formulário de geração */}
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="horas-dia" className="text-sm font-medium text-gray-700">
            Meta base diaria (horas/dia)
          </label>
          <input
            id="horas-dia"
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

        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Gerando roteiro…"
            : temBlocos
            ? "Regenerar roteiro"
            : "Gerar roteiro"}
        </Button>
      </form>

      {/* Nota sobre regeneração */}
      {temBlocos && !isPending && (
        <p className="text-xs text-gray-400 mt-2">
          Regenerar preserva blocos marcados como feitos e os agendados manualmente.
        </p>
      )}

      {/* Erro */}
      {erro && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

      {/* Estado de loading */}
      {isPending && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-400 text-sm">
          Calculando roteiro até 06/09/2026…
        </div>
      )}

      {/* Visualização dos blocos */}
      {!isPending && (
        <CronogramaView blocos={blocos} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
