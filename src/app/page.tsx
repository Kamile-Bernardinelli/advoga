import Link from "next/link";
import { AppShell } from "@/components/shared/app-shell";

// Prova OAB 1ª fase: 06/09/2026
const EXAM_DATE = new Date("2026-09-06T00:00:00-03:00");

function getDaysUntilExam(): number {
  const now = new Date();
  const diff = EXAM_DATE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const ambientes = [
  {
    href: "/teste",
    nome: "Teste",
    descricao: "Simule provas sem ver o gabarito — timer ativo, foco total.",
    cor: "bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-900 dark:hover:bg-blue-900/40",
  },
  {
    href: "/plano",
    nome: "Estudo",
    descricao: "Plano do dia gerado pelo motor: horas → questões priorizadas.",
    cor: "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-900 dark:hover:bg-green-900/40",
  },
  {
    href: "/questoes",
    nome: "Consulta",
    descricao: "Busque questões e legislação — com gabarito, modo estudo.",
    cor: "bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-900 dark:hover:bg-amber-900/40",
  },
  {
    href: "/dashboard",
    nome: "Verificação",
    descricao: "Dashboard de diagnóstico: pontos fracos, tendência, alvos.",
    cor: "bg-purple-50 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/30 dark:border-purple-900 dark:hover:bg-purple-900/40",
  },
];

export default function HomePage() {
  const diasRestantes = getDaysUntilExam();

  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-8">
      {/* Countdown — número em accent de marca (identidade na home, §4 home punch list) */}
      <section className="mb-10 text-center">
        <div className="text-6xl font-bold tabular-nums text-primary">
          {diasRestantes}
        </div>
        <div className="text-lg text-muted-foreground mt-1">
          dias até a OAB 1ª fase — 06/09/2026
        </div>
      </section>

      {/* 4 ambientes */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {ambientes.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`rounded-xl border p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:translate-y-px ${a.cor}`}
          >
            <h2 className="text-xl font-semibold text-foreground">{a.nome}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{a.descricao}</p>
          </Link>
        ))}
      </section>
      </div>
    </AppShell>
  );
}
