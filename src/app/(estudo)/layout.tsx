// AMBIENTE: ESTUDO — planner + reforço focado
// Layout com navegação entre sub-rotas do estudo
// Drop 1.5: adicionados links Cronograma e Registro (aditivo — não altera resto)
// Fatia B: adicionados Metas, Materiais, Progresso
import Link from "next/link";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const NAV_LINKS = [
  { href: "/plano",      label: "Plano do dia" },
  { href: "/cronograma", label: "Cronograma" },
  { href: "/metas",      label: "Metas" },
  { href: "/registro",   label: "Registro" },
  { href: "/materiais",  label: "Materiais" },
  { href: "/progresso",  label: "Progresso" },
  { href: "/treino",     label: "Treino" },
];

export default function EstudoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card px-6 py-3">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="font-semibold text-foreground shrink-0">Ambiente de Estudo</span>
          <nav className="flex items-center gap-1 flex-wrap">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
