"use client";

// First-run guided tour (proposal §3.2b) — spotlight/coachmark leve, custom,
// ZERO dependências novas. Montado no AppShell, portanto presente em toda tela
// não-teste. Comportamento:
//   - auto-dispara só na 1ª sessão (localStorage 'advoga.tour.done' ausente);
//   - Pular / Esc / fechar / concluir gravam o flag → nunca mais auto-aparece;
//   - re-disparável via evento de janela (botão "Rever tour" em /como-usar);
//   - acessível: role=dialog + aria-modal, focus trap, Esc fecha;
//   - sem layout shift (overlay) e sem FOUC (renderiza null até decidir no client);
//   - respeita prefers-reduced-motion (transições só com motion-safe).
//
// Técnica do holofote: um <div> posicionado sobre o alvo com box-shadow
// gigante escurece tudo ao redor recortando o alvo — 1 elemento, sem reflow.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  GraduationCap,
  Moon,
  HelpCircle,
  X,
} from "lucide-react";
import { TOUR_DONE_KEY, TOUR_EVENT } from "./tour-constants";

interface TourStep {
  /** Seletor do alvo; null = passo centralizado (sem holofote). */
  target: string | null;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
  /** Lado preferido do tooltip relativo ao alvo. */
  placement?: "bottom" | "top";
}

const STEPS: TourStep[] = [
  {
    target: null,
    icon: Compass,
    title: "Oi, Kamile! Bem-vinda ao Advoga",
    body: (
      <>
        Em 30 segundos eu te mostro como tudo funciona. A ideia é simples e gira
        sempre no mesmo ciclo: você <strong>estuda um subtema</strong>,{" "}
        <strong>treina questões</strong> daquele subtema, vê seu{" "}
        <strong>desempenho</strong> — e o sistema <strong>reprioriza</strong> o
        que vem a seguir. Vamos lá.
      </>
    ),
  },
  {
    target: '[data-tour="ambientes"]',
    icon: Compass,
    title: "Os 4 ambientes",
    body: (
      <>
        Tudo se organiza em quatro espaços:{" "}
        <strong>Estudo, Teste, Consulta e Verificação</strong>. Você troca entre
        eles por aqui, em qualquer tela. A marca <strong>Advoga</strong> sempre
        leva de volta para o início.
      </>
    ),
    placement: "bottom",
  },
  {
    target: '[data-tour="ambiente-estudo"]',
    icon: GraduationCap,
    title: "Comece pelo Estudo",
    body: (
      <>
        É o seu ponto de partida. Dentro do Estudo ficam o{" "}
        <strong>Cronograma</strong> (o que estudar, na ordem do que mais cai na
        FGV) e o <strong>Treino</strong> (as questões daquele subtema). Estude o
        conteúdo primeiro, depois treine.
      </>
    ),
    placement: "bottom",
  },
  {
    target: '[data-tour="theme-toggle"]',
    icon: Moon,
    title: "Claro ou escuro",
    body: (
      <>
        Estudando de madrugada? Toque aqui para alternar entre tema claro e
        escuro. Sua escolha fica salva.
      </>
    ),
    placement: "bottom",
  },
  {
    target: '[data-tour="como-usar"]',
    icon: HelpCircle,
    title: "Guia completo",
    body: (
      <>
        Sempre que tiver dúvida, abra <strong>Como usar</strong>: tem a
        explicação de cada parte do app — e o botão para{" "}
        <strong>rever este tour</strong> quando quiser.
      </>
    ),
    placement: "bottom",
  },
  {
    target: null,
    icon: Check,
    title: "Pronto para começar",
    body: (
      <>
        É isso! Meu conselho: abra o <strong>Cronograma</strong>, faça o bloco de
        hoje e treine as questões dele. Um pouco todo dia já te leva longe. 💪
      </>
    ),
  },
];

const PADDING = 8; // respiro do holofote ao redor do alvo

type Rect = { top: number; left: number; width: number; height: number };

export function FirstRunTour() {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [naoMostrar, setNaoMostrar] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  const markDone = useCallback(() => {
    try {
      localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {
      // localStorage indisponível: tour só não reaparece nesta sessão.
    }
  }, []);

  const start = useCallback(() => {
    setStepIdx(0);
    setNaoMostrar(true);
    setOpen(true);
  }, []);

  // Fecha gravando o flag (Pular / Esc / X / fechar). Finalizar usa a regra do
  // checkbox "não mostrar de novo" — ver finish().
  const close = useCallback(() => {
    setOpen(false);
    markDone();
  }, [markDone]);

  const finish = useCallback(() => {
    setOpen(false);
    if (naoMostrar) markDone();
  }, [markDone, naoMostrar]);

  // Auto-disparo só na 1ª sessão (decisão no client → sem FOUC/SSR mismatch).
  // setState é diferido para o próximo frame (ainda antes do paint) para não
  // disparar render em cascata dentro do corpo do efeito.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(TOUR_DONE_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    const raf = requestAnimationFrame(() => start());
    return () => cancelAnimationFrame(raf);
  }, [start]);

  // Replay via evento ("Rever tour"). Abre do passo 0, ignorando o flag.
  useEffect(() => {
    const handler = () => start();
    window.addEventListener(TOUR_EVENT, handler);
    return () => window.removeEventListener(TOUR_EVENT, handler);
  }, [start]);

  // Mede o alvo do passo atual e reposiciona o holofote (resize/scroll/passo).
  useEffect(() => {
    if (!open) return;

    const measure = () => {
      if (!step.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.target);
      if (!el) {
        setRect(null); // alvo ausente → degrada para passo centralizado
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Garante o alvo visível antes de medir (alvos vivem no header, topo).
    if (step.target) {
      document.querySelector(step.target)?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }

    let raf = 0;
    const onScrollResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [open, stepIdx, step.target]);

  // Foco inicial + focus trap + Esc.
  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    if (!node) return;

    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));

    // Foca o primeiro elemento interativo do passo.
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [open, stepIdx, close]);

  if (!open) return null;

  const StepIcon = step.icon;
  const hasSpotlight = rect !== null;

  // Posição do tooltip: ao lado do alvo (clampado na viewport) ou centralizado.
  const tooltipStyle: React.CSSProperties = (() => {
    if (!rect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const below = step.placement !== "top";
    const gap = PADDING + 12;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const TOOLTIP_W = 320;
    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    left = Math.max(12, Math.min(left, vw - TOOLTIP_W - 12));
    const top = below
      ? rect.top + rect.height + gap
      : Math.max(12, rect.top - gap);
    return below
      ? { top, left, width: TOOLTIP_W }
      : { top, left, width: TOOLTIP_W, transform: "translateY(-100%)" };
  })();

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      {/* Bloqueador de cliques. Para passos centralizados ele também escurece;
          nos passos com holofote o escurecimento vem do box-shadow abaixo. */}
      <div
        className={hasSpotlight ? "absolute inset-0" : "absolute inset-0 bg-black/55"}
        aria-hidden="true"
      />

      {/* Holofote: recorta o alvo escurecendo o resto via box-shadow. */}
      {hasSpotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      )}

      {/* Tooltip / card do passo */}
      <div
        ref={dialogRef}
        style={tooltipStyle}
        className="absolute w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-card p-5 shadow-xl motion-safe:transition-all motion-safe:duration-200"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fechar tour"
          className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>

        <div className="mb-2 flex items-center gap-2 pr-7">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <StepIcon className="size-4" />
          </span>
          <h2 id={titleId} className="text-base font-bold text-foreground">
            {step.title}
          </h2>
        </div>

        <p
          id={descId}
          className="text-sm leading-relaxed text-muted-foreground"
        >
          {step.body}
        </p>

        {isLast && (
          <label className="mt-4 flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={naoMostrar}
              onChange={(e) => setNaoMostrar(e.target.checked)}
              className="size-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            Não mostrar este tour novamente
          </label>
        )}

        {/* Progresso + controles */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={[
                  "h-1.5 rounded-full transition-all",
                  i === stepIdx ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
                ].join(" ")}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="size-3.5" />
                Anterior
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Check className="size-3.5" />
                Concluir
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Próximo
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {!isLast && (
          <button
            type="button"
            onClick={close}
            className="mt-3 w-full rounded-md py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Pular tour
          </button>
        )}
      </div>
    </div>
  );
}
