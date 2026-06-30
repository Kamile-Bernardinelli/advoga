// AMBIENTE: CONSULTA — legislação + banco pesquisável (mobile-friendly)
// Fase 1 (AppShell): header global de 2 camadas. Tier 2 = Questões | Legislação
// (antes a Consulta não tinha nav alguma — finding A4).
import { AppShell } from "@/components/shared/app-shell";

const SUB_NAV = [
  { href: "/questoes", label: "Questões" },
  { href: "/legislacao", label: "Legislação" },
];

export default function ConsultaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell secondaryNav={SUB_NAV}>{children}</AppShell>;
}
