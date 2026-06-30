// [RSC] Cronograma de Estudo — Cockpit Drop 1.5, Fatia 1
// Carrega blocos de hoje + semana e renderiza:
//   - CronogramaControls (client): input de horas/dia, botão gerar/regenerar
//   - CronogramaView (client): lista de blocos marcáveis por dia

import { carregarCronograma } from "@/app/(estudo)/_actions/cronograma.actions";
import { CronogramaControls } from "./cronograma-controls";

export default async function CronogramaPage() {
  const blocos = await carregarCronograma("semana");

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 text-foreground">Roteiro de Estudo</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Blocos de conteúdo e questões gerados pelo planner, priorizados por
        incidência FGV e fraqueza diagnosticada (gate ≥ 8 questões). Marque cada
        bloco como feito ao concluir.
      </p>

      {/* Controles: input horas/dia + botão gerar/regenerar */}
      <CronogramaControls blocosIniciais={blocos} />
    </div>
  );
}
