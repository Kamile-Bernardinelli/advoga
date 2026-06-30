"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProvaStore } from "@/lib/store/prova-store";
import { saveResposta, finalizeSession } from "../../_actions/sessao.actions";
import { BRAND_CLASS } from "@/components/shared/brand";

type Letra = "A" | "B" | "C" | "D";

interface Questao {
  id: string;
  enunciado: string;
  alt_a: string;
  alt_b: string;
  alt_c: string;
  alt_d: string;
  num_prova: number | null;
  validade_status: string;
  materia_id: string | null;
  subtema_id: string | null;
}

interface Props {
  sessaoId: string;
  questoes: Questao[];
  respostasIniciais: Record<string, string | null>;
  inicio: string;
}

const LETRAS: Letra[] = ["A", "B", "C", "D"];

// Formata segundos como HH:MM:SS
function formatTime(totalSeg: number): string {
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function ProvaRunner({ sessaoId, questoes, respostasIniciais, inicio }: Props) {
  const router = useRouter();
  const { respostas, questaoAtual, setResposta, setQuestaoAtual, initStore } = useProvaStore();
  const [segundos, setSegundos] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const savingRef = useRef<Set<string>>(new Set());

  // Inicializa store + timer baseado no tempo decorrido REAL desde o início da sessão
  // (robusto a throttling de aba; sem setState síncrono no corpo do effect)
  useEffect(() => {
    const inicioMs = new Date(inicio).getTime();
    initStore(respostasIniciais, inicioMs);
    const tick = () => setSegundos(Math.floor((Date.now() - inicioMs) / 1000));
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const questaoAtualObj = questoes[questaoAtual];

  const handleRespostaFixed = useCallback(
    async (questaoId: string, letra: Letra) => {
      if (savingRef.current.has(questaoId)) return;
      savingRef.current.add(questaoId);
      setResposta(questaoId, letra);
      await saveResposta(sessaoId, questaoId, letra, segundos);
      savingRef.current.delete(questaoId);
    },
    [sessaoId, segundos, setResposta]
  );

  const totalRespondidas = Object.values(respostas).filter(Boolean).length;
  const totalQuestoes = questoes.length;

  if (!questaoAtualObj) {
    return <div className="p-8 text-muted-foreground">Carregando prova...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted">
      {/* Header fixo com timer */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Marca → home. Modo foco: gateada por confirm (sessão ativa). */}
          <button
            type="button"
            onClick={() => setShowExit(true)}
            aria-label="Sair para a página inicial"
            className={BRAND_CLASS}
          >
            Advoga
          </button>
          <span className="text-sm font-medium text-muted-foreground">
            OAB — Prova Simulada
          </span>
          <span className="text-sm text-muted-foreground">
            {totalRespondidas}/{totalQuestoes} respondidas
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="tabular-nums font-mono text-lg font-semibold text-foreground">
            {formatTime(segundos)}
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="rounded-lg bg-red-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Finalizar
          </button>
        </div>
      </header>

      <div className="flex flex-1 max-w-6xl mx-auto w-full gap-6 p-6">
        {/* Índice lateral */}
        <aside className="w-48 flex-shrink-0">
          <div className="bg-card rounded-xl border border-border p-3 sticky top-20">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Questões
            </p>
            <div className="grid grid-cols-5 gap-1">
              {questoes.map((q, idx) => {
                const respondida = Boolean(respostas[q.id]);
                const isAtual = idx === questaoAtual;
                return (
                  <button
                    key={q.id}
                    onClick={() => setQuestaoAtual(idx)}
                    className={`
                      w-8 h-8 rounded text-xs font-medium transition-colors
                      ${isAtual
                        ? "bg-primary text-white"
                        : respondida
                        ? "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                        : "bg-muted text-muted-foreground hover:bg-muted"
                      }
                    `}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Questão principal */}
        <main className="flex-1">
          <div className="bg-card rounded-xl border border-border p-6">
            {/* Header da questão */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-semibold text-muted-foreground">
                Questão {questaoAtualObj.num_prova ?? questaoAtual + 1}
              </span>
              {questaoAtualObj.validade_status === "anulada" && (
                <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-950/50 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-300">
                  Anulada (FGV)
                </span>
              )}
            </div>

            {/* Enunciado */}
            <div className="text-foreground leading-relaxed mb-6 text-sm whitespace-pre-line">
              {questaoAtualObj.enunciado}
            </div>

            {/* Alternativas */}
            <div className="space-y-2">
              {LETRAS.map((letra, i) => {
                const textoAlternativa =
                  letra === "A" ? questaoAtualObj.alt_a :
                  letra === "B" ? questaoAtualObj.alt_b :
                  letra === "C" ? questaoAtualObj.alt_c :
                  questaoAtualObj.alt_d;

                const selecionada = respostas[questaoAtualObj.id] === letra;

                return (
                  <button
                    key={letra}
                    onClick={() => handleRespostaFixed(questaoAtualObj.id, letra)}
                    className={`
                      w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors
                      ${selecionada
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-ring hover:bg-muted text-foreground"
                      }
                    `}
                  >
                    <span className={`font-semibold mr-2 ${selecionada ? "text-primary" : "text-muted-foreground"}`}>
                      {letra})
                    </span>
                    {textoAlternativa}
                  </button>
                );
              })}
            </div>

            {/* Navegação */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setQuestaoAtual(Math.max(0, questaoAtual - 1))}
                disabled={questaoAtual === 0}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <span className="text-sm text-muted-foreground">
                {questaoAtual + 1} de {totalQuestoes}
              </span>
              <button
                onClick={() => setQuestaoAtual(Math.min(totalQuestoes - 1, questaoAtual + 1))}
                disabled={questaoAtual === totalQuestoes - 1}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Modal de confirmação */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-2">Finalizar prova?</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Você respondeu <strong>{totalRespondidas}</strong> de{" "}
              <strong>{totalQuestoes}</strong> questões.
            </p>
            {totalRespondidas < totalQuestoes && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
                {totalQuestoes - totalRespondidas} questão(ões) sem resposta serão
                contadas como erradas.
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <form
                action={async () => {
                  setFinalizando(true);
                  await finalizeSession(sessaoId);
                }}
              >
                <button
                  type="submit"
                  disabled={finalizando}
                  className="flex-1 rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  {finalizando ? "Finalizando..." : "Confirmar e ver resultado"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de saída (marca → home). Mesmo padrão visual do confirm acima;
          NÃO toca finalizeSession/gabarito — só navega. As respostas já são
          salvas a cada clique (saveResposta), então sair é não-destrutivo. */}
      {showExit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-2">Sair da prova?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Suas respostas já estão salvas. A prova continua aberta e você pode
              retomá-la depois. Deseja voltar para a página inicial?
            </p>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowExit(false)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

