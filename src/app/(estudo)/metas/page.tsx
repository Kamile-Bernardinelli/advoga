// [RSC] Metas de Estudo — Cockpit Fatia B
// Carrega config, overrides, saldos e renderiza MetasForm (client).

import { carregarMetas, carregarOverridesMes } from "@/app/(estudo)/_actions/metas.actions";
import { carregarSaldoDiario, carregarSaldoMensal } from "@/app/(estudo)/_actions/saldo.actions";
import { hojeLocal } from "@/lib/metas/saldo";
import { MetasForm } from "./metas-form";

export default async function MetasPage() {
  const [metas, saldoMensal] = await Promise.all([
    carregarMetas(),
    carregarSaldoMensal(),
  ]);

  const tz   = metas?.timezone ?? "America/Sao_Paulo";
  const hoje = hojeLocal(tz);
  const mesIso = hoje.slice(0, 7); // YYYY-MM

  // Carrega overrides do mês corrente + saldos dos últimos 14 dias em paralelo
  const [overrides, saldosMes] = await Promise.all([
    carregarOverridesMes(mesIso),
    carregarSaldoDiario("mes"),
  ]);

  // Últimos 14 dias para o gráfico de barras
  const saldos14 = saldosMes.slice(-14);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Metas de Estudo</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure meta diaria, mensal, dias de estudo e overrides por dia.
          Use a compensacao para redistribuir deficit do mes.
        </p>
      </div>

      <MetasForm
        metas={metas}
        overrides={overrides}
        saldosMes={saldos14}
        saldoMensal={saldoMensal}
        hoje={hoje}
      />
    </div>
  );
}
