/**
 * Zustand store para estado efêmero da prova ativa.
 * Respostas são capturadas aqui e persistidas via Server Action (saveResposta).
 */

import { create } from "zustand";

type Letra = "A" | "B" | "C" | "D";

interface ProvaState {
  // Respostas capturadas: questaoId → letra
  respostas: Record<string, Letra | null>;
  // Questão atual (índice 0-based)
  questaoAtual: number;
  // Timestamp de início (ms) para calcular tempo por questão
  inicioMs: number;

  // Actions
  setResposta: (questaoId: string, letra: Letra | null) => void;
  setQuestaoAtual: (idx: number) => void;
  initStore: (respostasIniciais: Record<string, string | null>, inicioMs: number) => void;
}

export const useProvaStore = create<ProvaState>((set) => ({
  respostas: {},
  questaoAtual: 0,
  inicioMs: Date.now(),

  initStore: (respostasIniciais, inicioMs) =>
    set({
      respostas: respostasIniciais as Record<string, Letra | null>,
      inicioMs,
    }),

  setResposta: (questaoId, letra) =>
    set((state) => ({
      respostas: { ...state.respostas, [questaoId]: letra },
    })),

  setQuestaoAtual: (idx) => set({ questaoAtual: idx }),
}));
