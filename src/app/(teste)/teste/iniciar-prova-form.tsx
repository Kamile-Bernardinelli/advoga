"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startSession } from "../_actions/sessao.actions";

interface Props {
  exameId: string;
  tipo: string;
}

export default function IniciarProvaForm({ exameId, tipo }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Mapeia tipo_prova para sessao_tipo
  function mapTipo(tipProva: string): "prova_oficial" | "simulado" | "treino" {
    if (tipProva === "prova_oficial") return "prova_oficial";
    if (tipProva === "simulado") return "simulado";
    return "treino";
  }

  async function handleIniciar() {
    setLoading(true);
    setError(null);

    const result = await startSession(exameId, mapTipo(tipo));

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`/teste/${result.sessaoId}`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleIniciar}
        disabled={loading}
        className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors whitespace-nowrap"
      >
        {loading ? "Iniciando..." : "Iniciar Prova"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
