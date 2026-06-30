"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Tier 1: os 4 ambientes. `match` cobre TODAS as sub-rotas de cada ambiente,
// para que o estado ativo destaque o ambiente correto em qualquer sub-página
// (ex.: em /cronograma o ambiente ativo continua sendo "Estudo").
// `tour` (opcional) ancora o first-run tour em ambientes específicos (Fase 2).
interface Ambiente {
  href: string;
  label: string;
  match: string[];
  tour?: string;
}

const AMBIENTES: Ambiente[] = [
  { href: "/teste", label: "Teste", match: ["/teste"] },
  {
    href: "/plano",
    label: "Estudo",
    tour: "ambiente-estudo",
    match: [
      "/plano",
      "/cronograma",
      "/metas",
      "/registro",
      "/materiais",
      "/progresso",
      "/treino",
    ],
  },
  { href: "/questoes", label: "Consulta", match: ["/questoes", "/legislacao"] },
  {
    href: "/dashboard",
    label: "Verificação",
    match: ["/dashboard", "/incidencia", "/resultado"],
  },
];

// Nav dos 4 ambientes. Usado pelo AppShell (Tier 1). Ativo = accent de marca.
export function Nav() {
  const pathname = usePathname() ?? "";

  return (
    <nav data-tour="ambientes" className="flex flex-wrap gap-1">
      {AMBIENTES.map(({ href, label, match, tour }) => {
        const isActive = match.some(
          (m) => pathname === m || pathname.startsWith(m + "/")
        );
        return (
          <Link
            key={href}
            href={href}
            data-tour={tour}
            aria-current={isActive ? "page" : undefined}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
