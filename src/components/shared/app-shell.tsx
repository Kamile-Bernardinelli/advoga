import Link from "next/link";
import { Brand } from "@/components/shared/brand";
import { Nav } from "@/components/shared/nav";
import { SubNav, type SubNavLink } from "@/components/shared/sub-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { FirstRunTour } from "@/components/onboarding/first-run-tour";

interface AppShellProps {
  children: React.ReactNode;
  /** Tier 2: sub-rotas do ambiente atual. Omitido → só o header Tier 1 (ex.: home). */
  secondaryNav?: SubNavLink[];
}

// Shell global de duas camadas (proposal §3.3). Server component — só as ilhas
// (Nav, SubNav, ThemeToggle) são client. Usado por todos os ambientes não-teste.
//
// Tier 1 (sempre): marca→home + 4 ambientes + "Como usar" + theme toggle.
//   → o link da marca sozinho resolve o dead-end da home (finding A1) em toda tela.
// Tier 2 (opcional): sub-rotas do ambiente, aninhadas sob o Tier 1.
export function AppShell({ children, secondaryNav }: AppShellProps) {
  const hasSecondary = secondaryNav && secondaryNav.length > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card">
        {/* Tier 1 — primário, sempre visível */}
        <div className="flex flex-wrap items-center gap-4 px-6 py-3">
          <Brand className="shrink-0" />
          <Nav />
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/como-usar"
              data-tour="como-usar"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Como usar
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {/* Tier 2 — contextual, sub-rotas do ambiente atual */}
        {hasSecondary && (
          <div className="border-t border-border px-6 py-2">
            <SubNav links={secondaryNav} />
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* First-run tour (Fase 2) — ilha cliente; auto-dispara só na 1ª sessão. */}
      <FirstRunTour />
    </div>
  );
}
