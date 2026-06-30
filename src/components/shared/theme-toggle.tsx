"use client";

import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "advoga.theme";

/**
 * Alterna entre tema claro/escuro.
 *
 * O ícone é controlado puramente por CSS (`dark:` variant), portanto o markup
 * do servidor e do cliente são idênticos — sem hydration mismatch e sem
 * necessidade de estado `mounted`. O estado real do tema vive na classe `dark`
 * de <html>, aplicada antes do paint pelo script anti-FOUC no root layout.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // localStorage indisponível (modo privado): tema vale só nesta sessão.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      data-tour="theme-toggle"
      aria-label="Alternar tema claro/escuro"
      title="Alternar tema"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-9"
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  );
}
