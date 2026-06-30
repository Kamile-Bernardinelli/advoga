"use client";

// Botão "Rever tour" para a página /como-usar (proposal §3.2b).
// Re-dispara o first-run tour na mesma página via evento de janela — sem limpar
// estado, sem recriar conta. O FirstRunTour (montado no AppShell) escuta o evento.

import { RefreshCw } from "lucide-react";
import { TOUR_EVENT } from "./tour-constants";

export function ReverTourButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <RefreshCw className="size-4" />
      Rever tour
    </button>
  );
}
