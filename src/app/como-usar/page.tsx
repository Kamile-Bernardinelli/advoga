// [RSC] "Como usar" — placeholder da Fase 1.
// Existe para que o link de nav (AppShell) não dê 404. A Fase 2 preenche com o
// conteúdo real (guia por ambiente) + o first-run tour (proposal §3.2).
import { AppShell } from "@/components/shared/app-shell";

export const metadata = {
  title: "Como usar — Advoga",
};

export default function ComoUsarPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl p-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Como usar</h1>
        <p className="mb-6 text-muted-foreground">
          Guia rápido de cada ambiente do Advoga.
        </p>
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          Conteúdo em breve.
        </div>
      </div>
    </AppShell>
  );
}
