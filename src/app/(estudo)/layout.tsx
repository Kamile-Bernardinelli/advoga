// AMBIENTE: ESTUDO — planner + reforço focado
// Fase 1 (AppShell): o header global de 2 camadas substitui o header local.
// Tier 2 = sub-rotas do estudo. ThemeToggle agora vive no shell (sem duplicata).
import { AppShell } from "@/components/shared/app-shell";

const SUB_NAV = [
  { href: "/plano", label: "Plano do dia" },
  { href: "/cronograma", label: "Cronograma" },
  { href: "/metas", label: "Metas" },
  { href: "/registro", label: "Registro" },
  { href: "/materiais", label: "Materiais" },
  { href: "/progresso", label: "Progresso" },
  { href: "/treino", label: "Treino" },
];

export default function EstudoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell secondaryNav={SUB_NAV}>{children}</AppShell>;
}
