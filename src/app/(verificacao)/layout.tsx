// AMBIENTE: VERIFICAÇÃO — correção + diagnóstico + dashboard
// Fase 1 (AppShell): header global de 2 camadas. Tier 2 = Dashboard | Incidência.
// (/resultado/[sessaoId] não tem entrada no Tier 2; o Tier 1 ainda marca "Verificação".)
import { AppShell } from "@/components/shared/app-shell";

const SUB_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/incidencia", label: "Incidência" },
];

export default function VerificacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell secondaryNav={SUB_NAV}>{children}</AppShell>;
}
