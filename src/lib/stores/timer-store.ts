// Timer store — Zustand com persist no localStorage.
// Único timer por vez: iniciar outro pede para parar o atual.
// Sobrevive a refresh/aba fechada (startedAt em epochMs).

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface TimerState {
  /** ID do bloco do cronograma amarrado ao timer (ou null se avulso). */
  blocoId: string | null;
  /** UUID da matéria sendo cronometrada. */
  materiaId: string | null;
  /** UUID do subtema (opcional). */
  subtemaId: string | null;
  /** Epoch ms do instante em que o timer foi iniciado. null = parado. */
  startedAt: number | null;
}

interface TimerActions {
  /** Inicia o timer. Se já houver outro rodando, substituí-lo. */
  iniciarTimer: (opts: Omit<TimerState, "startedAt">) => void;
  /** Para o timer e retorna os dados da sessão (ou null se não havia timer). */
  pararTimer: () => { startedAt: number; materiaId: string; subtemaId: string | null; blocoId: string | null } | null;
  /** Reseta sem retornar dados (abandono). */
  resetarTimer: () => void;
  /** Verifica se há um timer rodando. */
  estaRodando: () => boolean;
}

const ESTADO_INICIAL: TimerState = {
  blocoId: null,
  materiaId: null,
  subtemaId: null,
  startedAt: null,
};

export const useTimerStore = create<TimerState & TimerActions>()(
  persist(
    (set, get) => ({
      ...ESTADO_INICIAL,

      iniciarTimer(opts) {
        set({
          blocoId: opts.blocoId,
          materiaId: opts.materiaId,
          subtemaId: opts.subtemaId,
          startedAt: Date.now(),
        });
      },

      pararTimer() {
        const { startedAt, materiaId, subtemaId, blocoId } = get();
        if (!startedAt || !materiaId) {
          set(ESTADO_INICIAL);
          return null;
        }
        const snapshot = { startedAt, materiaId, subtemaId, blocoId };
        set(ESTADO_INICIAL);
        return snapshot;
      },

      resetarTimer() {
        set(ESTADO_INICIAL);
      },

      estaRodando() {
        return get().startedAt !== null;
      },
    }),
    {
      name: "advoga-timer-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : sessionStorage
      ),
    }
  )
);
