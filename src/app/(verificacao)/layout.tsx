// AMBIENTE: VERIFICAÇÃO — correção + diagnóstico + dashboard
// Drop 4: adicionada nav (Dashboard | Incidência), espelhando (estudo)/layout.tsx — aditivo.
import Link from "next/link";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/incidencia", label: "Incidência" },
];

export default function VerificacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-3">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="font-semibold text-gray-900 shrink-0">Ambiente de Verificação</span>
          <nav className="flex items-center gap-1 flex-wrap">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
