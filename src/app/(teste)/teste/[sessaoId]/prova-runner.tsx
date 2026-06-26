"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useProvaStore } from "@/lib/store/prova-store";
import { saveResposta, finalizeSession } from "../../_actions/sessao.actions";

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
  const { respostas, questaoAtual, setResposta, setQuestaoAtual, initStore } = useProvaStore();
  const [segundos, setSegundos] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
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
    return <div className="p-8 text-gray-500">Carregando prova...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header fixo com timer */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600">
            OAB — Prova Simulada
          </span>
          <span className="text-sm text-gray-400">
            {totalRespondidas}/{totalQuestoes} respondidas
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="tabular-nums font-mono text-lg font-semibold text-gray-800">
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
          <div className="bg-white rounded-xl border border-gray-200 p-3 sticky top-20">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
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
                        ? "bg-blue-600 text-white"
                        : respondida
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {/* Header da questão */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-semibold text-gray-500">
                Questão {questaoAtualObj.num_prova ?? questaoAtual + 1}
              </span>
              {questaoAtualObj.validade_status === "anulada" && (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                  Anulada (FGV)
                </span>
              )}
            </div>

            {/* Enunciado */}
            <div className="text-gray-900 leading-relaxed mb-6 text-sm whitespace-pre-line">
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
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700"
                      }
                    `}
                  >
                    <span className={`font-semibold mr-2 ${selecionada ? "text-blue-600" : "text-gray-400"}`}>
                      {letra})
                    </span>
                    {textoAlternativa}
                  </button>
                );
              })}
            </div>

            {/* Navegação */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setQuestaoAtual(Math.max(0, questaoAtual - 1))}
                disabled={questaoAtual === 0}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-400">
                {questaoAtual + 1} de {totalQuestoes}
              </span>
              <button
                onClick={() => setQuestaoAtual(Math.min(totalQuestoes - 1, questaoAtual + 1))}
                disabled={questaoAtual === totalQuestoes - 1}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
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
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Finalizar prova?</h2>
            <p className="text-sm text-gray-600 mb-1">
              Você respondeu <strong>{totalRespondidas}</strong> de{" "}
              <strong>{totalQuestoes}</strong> questões.
            </p>
            {totalRespondidas < totalQuestoes && (
              <p className="text-sm text-amber-600 mb-4">
                {totalQuestoes - totalRespondidas} questão(ões) sem resposta serão
                contadas como erradas.
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
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
    </div>
  );
}

