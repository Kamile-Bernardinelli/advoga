"use client";

// Formulário de início de treino por subtema (Drop 2.5).
// Espelha iniciar-prova-form.tsx; usa startTreinoSubtema em vez de startSession.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startTreinoSubtema } from "@/app/(teste)/_actions/sessao.actions";

export default function IniciarTreinoForm({ subtemaId }: { subtemaId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleIniciar() {
    setLoading(true);
    setError(null);
    const r = await startTreinoSubtema(subtemaId);
    if ("error" in r) {
      setError(r.error);
      setLoading(false);
      return;
    }
    router.push(`/teste/${r.sessaoId}`);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleIniciar}
        disabled={loading}
        className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? "Iniciando..." : "Iniciar treino do subtema"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
