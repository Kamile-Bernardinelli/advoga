// Constantes compartilhadas do onboarding (Fase 2).
// Módulo puro (sem "use client") para ser importado por qualquer ilha cliente
// sem arrastar o bundle do componente de tour junto.

/** Chave de localStorage: marca que a usuária já viu (ou pulou) o tour. */
export const TOUR_DONE_KEY = "advoga.tour.done";

/**
 * Evento de janela para re-disparar o tour (botão "Rever tour" em /como-usar).
 * Permite replay na mesma página, sem precisar limpar o estado nem recriar conta.
 */
export const TOUR_EVENT = "advoga:start-tour";
