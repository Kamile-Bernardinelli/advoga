// AMBIENTE: CONSULTA — legislação + banco pesquisável (mobile-friendly)
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function ConsultaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-foreground">
            Ambiente de Consulta
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
