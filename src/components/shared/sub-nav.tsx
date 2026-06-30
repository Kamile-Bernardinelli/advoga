"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SubNavLink {
  href: string;
  label: string;
}

// Tier 2 do AppShell: sub-rotas do ambiente atual, com estado ativo sutil
// (bg-muted) — distinto do Tier 1, cujo ativo usa o accent de marca (bg-primary).
export function SubNav({ links }: { links: SubNavLink[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {links.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-muted font-medium text-foreground"
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
