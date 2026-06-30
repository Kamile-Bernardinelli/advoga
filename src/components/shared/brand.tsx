import Link from "next/link";
import { cn } from "@/lib/utils";

// Wordmark da marca. É o conserto central do dead-end da home: clicável → "/",
// presente em TODAS as telas (via AppShell; e nas telas de teste em foco).
// BRAND_CLASS é exportado para reuso onde a marca precisa ser um <button>
// (ex.: prova-runner, que intercepta a navegação com um confirm).
export const BRAND_CLASS =
  "rounded text-base font-bold tracking-tight text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Advoga — página inicial"
      className={cn(BRAND_CLASS, className)}
    >
      Advoga
    </Link>
  );
}
