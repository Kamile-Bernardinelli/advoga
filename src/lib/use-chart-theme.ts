"use client";

// Tema de gráficos (recharts) reativo ao dark mode — Fase 3 do overhaul UI/UX.
//
// PROBLEMA: recharts pinta séries/grid/eixos/tooltip com cores passadas como
// props (fill/stroke), que viram atributos SVG. SVG NÃO resolve `var(--token)`
// de forma confiável em atributo de apresentação, então não dá para passar
// `var(--primary)` direto. Tampouco dá para hardcodar hex (quebra no dark).
//
// SOLUÇÃO: resolver os tokens CSS para cores concretas em runtime e re-resolver
// quando o tema muda. Lemos o valor COMPUTADO de cada `var(--token)` via um
// elemento-sonda e normalizamos para rgb/hex via canvas (cobre oklch → rgb sem
// depender de suporte do recharts a oklch). Um MutationObserver na classe de
// <html> dispara o re-cálculo no toggle de tema (que vive nessa classe — ver
// theme-toggle.tsx).
//
// As cores semânticas (verde/âmbar/vermelho de desempenho) não têm token no
// design system, então são pares claro/escuro escolhidos para legibilidade AA
// nos dois fundos. O accent de marca (#6366f1 indigo) vem do token --primary
// resolvido → adapta sozinho (fica mais claro no dark, mais legível).

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export interface ChartTheme {
  /** true quando <html> tem a classe `dark`. */
  isDark: boolean;
  /** Linhas de grade (CartesianGrid). */
  grid: string;
  /** Labels/ticks dos eixos. */
  axis: string;
  /** Props prontas p/ <Tooltip {...theme.tooltipProps} /> (box + texto + cursor). */
  tooltipProps: {
    contentStyle: CSSProperties;
    labelStyle: CSSProperties;
    itemStyle: CSSProperties;
    cursor: { fill: string };
  };
  /** Cores de série. `primary` = accent de marca (token). Resto = semântico. */
  series: {
    /** Accent de marca (indigo) — séries "principais"/neutras de volume. */
    primary: string;
    /** Cinza p/ amostra insuficiente / sem juízo. */
    neutral: string;
    /** Verde (≥ meta). */
    positive: string;
    /** Âmbar (intermediário). */
    warning: string;
    /** Vermelho (abaixo). */
    negative: string;
    /** Barra de "meta"/backdrop (sutil). */
    metaBar: string;
    /** Linha de referência (meta 70%). */
    reference: string;
  };
}

// Defaults claros — usados no SSR/primeiro paint, antes do efeito resolver os
// tokens reais. Os gráficos dependem de largura do cliente (ResponsiveContainer)
// de qualquer forma, então não há flash perceptível.
const FALLBACK: ChartTheme = {
  isDark: false,
  grid: "#e5e7eb",
  axis: "#6b7280",
  tooltipProps: {
    contentStyle: {
      backgroundColor: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      fontSize: 12,
      color: "#111827",
      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
    },
    labelStyle: { color: "#111827", fontWeight: 600 },
    itemStyle: { color: "#111827" },
    cursor: { fill: "rgba(0,0,0,0.04)" },
  },
  series: {
    primary: "#6366f1",
    neutral: "#9ca3af",
    positive: "#16a34a",
    warning: "#d97706",
    negative: "#dc2626",
    metaBar: "#e5e7eb",
    reference: "#16a34a",
  },
};

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK);

  useEffect(() => {
    // Sonda invisível: resolve `var(--token)` no contexto da cascata real.
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;";
    document.body.appendChild(probe);

    // Canvas normaliza qualquer cor válida (incl. oklch) → rgb/hex que o SVG aceita.
    const ctx = document.createElement("canvas").getContext("2d");

    // Sentinel improvável: se o canvas NÃO conseguir parsear `computed` (ex.:
    // engine sem suporte a oklch no canvas), o fillStyle fica no sentinel e a
    // gente devolve o `computed` cru (que o renderizador SVG ainda pode aceitar)
    // em vez de um preto silencioso.
    const SENTINEL = "#fe0fdc";

    const resolve = (varName: string, fallback: string): string => {
      probe.style.color = "";
      probe.style.color = `var(${varName})`;
      const computed = getComputedStyle(probe).color;
      if (!computed) return fallback;
      if (!ctx) return computed;
      try {
        ctx.fillStyle = SENTINEL;
        ctx.fillStyle = computed;
        const out = ctx.fillStyle;
        return out && out.toLowerCase() !== SENTINEL ? out : computed;
      } catch {
        return computed;
      }
    };

    const build = (): ChartTheme => {
      const isDark = document.documentElement.classList.contains("dark");
      const primary = resolve("--primary", FALLBACK.series.primary);
      const grid = resolve("--border", isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb");
      const axis = resolve("--muted-foreground", isDark ? "#a1a1aa" : "#6b7280");
      const popover = resolve("--popover", isDark ? "#1f1f1f" : "#ffffff");
      const popoverFg = resolve("--popover-foreground", isDark ? "#fafafa" : "#111827");
      const border = resolve("--border", isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb");

      return {
        isDark,
        grid,
        axis,
        tooltipProps: {
          contentStyle: {
            backgroundColor: popover,
            border: `1px solid ${border}`,
            borderRadius: 8,
            fontSize: 12,
            color: popoverFg,
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
          },
          labelStyle: { color: popoverFg, fontWeight: 600 },
          itemStyle: { color: popoverFg },
          cursor: { fill: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
        },
        series: {
          primary,
          neutral: "#9ca3af",
          positive: isDark ? "#22c55e" : "#16a34a",
          warning: isDark ? "#fbbf24" : "#d97706",
          negative: isDark ? "#f87171" : "#dc2626",
          metaBar: isDark ? "#3f3f46" : "#e5e7eb",
          reference: isDark ? "#22c55e" : "#16a34a",
        },
      };
    };

    const apply = () => setTheme(build());

    // Resolução inicial deferida (rAF) — evita setState síncrono no corpo do
    // effect (regra react-hooks/set-state-in-effect; mesmo padrão do first-run-tour).
    const raf = requestAnimationFrame(apply);

    // Re-resolve no toggle de tema (classe `dark` em <html>). Callback do
    // observer → setState permitido (não é síncrono no corpo do effect).
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      probe.remove();
    };
  }, []);

  return theme;
}
