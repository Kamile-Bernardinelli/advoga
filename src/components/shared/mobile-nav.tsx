"use client";

// Nav mobile (< md) — Fase 3 do overhaul. Hamburger no Tier 1 que abre um painel
// com os 4 ambientes + "Como usar". Reusa AMBIENTES de nav.tsx (mesma fonte de
// verdade do desktop) e o mesmo estado-ativo por prefixo. No >= md fica oculto
// (md:hidden); lá o <Nav> inline assume.
//
// A11y: botão com aria-expanded/aria-controls/aria-label, Esc fecha, clique no
// backdrop fecha, cada link fecha ao navegar, tap targets >= 44px, foco visível.
// Transições só com motion-safe (respeita prefers-reduced-motion) — convenção do
// first-run-tour.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AMBIENTES } from "@/components/shared/nav";

export function MobileNav() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  // Fecha ao trocar de rota (cobre back/forward do browser; os links também
  // fecham no onClick). rAF evita setState síncrono no corpo do effect
  // (regra react-hooks/set-state-in-effect; mesmo padrão do first-run-tour).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(false));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  // Esc fecha o painel.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const linkBase =
    "flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {open && (
        <>
          {/* Backdrop — clique fora fecha. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-0 z-30 cursor-default bg-foreground/20"
          />

          {/* Painel — dropdown abaixo do Tier 1. */}
          <div
            id="mobile-nav-panel"
            className="absolute left-0 right-0 top-full z-40 border-b border-border bg-card p-3 shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
          >
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Navegar
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5">
              {AMBIENTES.map(({ href, label, match }) => {
                const isActive = match.some(
                  (m) => pathname === m || pathname.startsWith(m + "/")
                );
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      linkBase,
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {label}
                  </Link>
                );
              })}

              <div className="my-1 border-t border-border" />

              <Link
                href="/como-usar"
                onClick={() => setOpen(false)}
                aria-current={pathname.startsWith("/como-usar") ? "page" : undefined}
                className={[
                  linkBase,
                  pathname.startsWith("/como-usar")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                Como usar
              </Link>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
