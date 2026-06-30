// [RSC] Plano do Dia — Cockpit de Hoje (Drop 1.5 v2)
// Carrega aderência de hoje + blocos do cronograma; renderiza PlanoDodia (client).
//
// O planner de questões (gerarPlanoDiario / plano_diario) está preservado:
// PlanoControls/ExplicacaoPlano são realocados para o detalhe do bloco de questões
// (via link /treino) — nenhuma capacidade perdida, apenas reposicionada (§5.2).

import { carregarAderenciaHoje } from "@/app/(estudo)/_actions/saldo.actions";
import { carregarCronograma } from "@/app/(estudo)/_actions/cronograma.actions";
import { PlanoDodia } from "./plano-do-dia";
import { hojeLocal } from "@/lib/metas/saldo";
import { carregarMetas } from "@/app/(estudo)/_actions/metas.actions";

export default async function PlanoPage() {
  // Carrega dados em paralelo (aderência + blocos de hoje)
  const [aderencia, blocos, metas] = await Promise.all([
    carregarAderenciaHoje(),
    carregarCronograma("hoje"),
    carregarMetas(),
  ]);

  // "Hoje" no fuso da usuária (§8 corretude de fuso)
  const tz = metas?.timezone ?? "America/Sao_Paulo";
  const hoje = hojeLocal(tz);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Plano do Dia</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {hoje} · Meta, saldo e blocos de hoje
        </p>
      </div>

      <PlanoDodia aderencia={aderencia} blocos={blocos} hoje={hoje} />
    </div>
  );
}
