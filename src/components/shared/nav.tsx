"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/teste", label: "Teste" },
  { href: "/plano", label: "Estudo" },
  { href: "/questoes", label: "Consulta" },
  { href: "/dashboard", label: "Verificação" },
];

// Nav desktop-first dos 4 ambientes.
// Usado pelo AppShell e pelos layouts de cada route group.
export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {links.map((link) => {
        const isActive = pathname?.startsWith(link.href) ?? false;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "px-3 py-1.5 rounded text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
