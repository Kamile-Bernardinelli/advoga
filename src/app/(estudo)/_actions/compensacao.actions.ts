"use server";

// Server Actions — Compensação de Saldo (Cockpit Fatia B)
//
// Contratos:
//   previewCompensacao()   → PropostaCompensacao | null  (cálculo sem gravar)
//   aplicarCompensacao()   → { ok, diasAplicados } | { ok: false, erro }
//
// Fluxo:
//   1. Carrega metas (base, diasEstudo) + saldo acumulado do mês
//   2. Calcula proposta com calcularPropostaCompensacao (puro, saldo.ts)
//   3. [apply only] Grava overrides em metas_diarias
//   4. [apply only] Chama regenerarCronograma() → re-plana os blocos

import { createActionClient } from "@/lib/supabase/action";
import {
  hojeLocal,
  calcularPropostaCompensacao,
  type PropostaCompensacao,
} from "@/lib/metas/saldo";
import { minutosTetoCompensacao } from "@/lib/planner/config";
import { regenerarCronograma } from "@/app/(estudo)/_actions/cronograma.actions";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// previewCompensacao
// ---------------------------------------------------------------------------

/**
 * Calcula a proposta de compensação sem gravar nada.
 * A UI mostra o preview e pede confirmação antes de aplicar.
 */
export async function previewCompensacao(): Promise<PropostaCompensacao | null> {
  try {
    const client = await createActionClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    // 1. Metas
    const { data: metasRow } = await client
      .from("metas_estudo")
      .select("meta_base_diaria_min, dias_estudo, timezone, meta_mensal_min")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!metasRow) return null;

    const metas = metasRow as {
      meta_base_diaria_min: number;
      dias_estudo: number[];
      timezone: string;
      meta_mensal_min: number | null;
    };
    const tz   = metas.timezone;
    const hoje = hojeLocal(tz);

    // 2. Saldo acumulado do mês (de v_saldo_diario — fato do DB)
    const { data: saldoRow } = await client
      .from("v_saldo_diario")
      .select("saldo_acum_mes")
      .eq("user_id", user.id)
      .eq("dia", hoje)
      .maybeSingle();

    // saldo_acum_mes < 0 → déficit a recuperar
    const saldoAcumMes = (saldoRow as { saldo_acum_mes: number | null } | null)?.saldo_acum_mes ?? 0;
    const restanteMes  = Math.max(0, -saldoAcumMes); // déficit = positivo aqui

    // 3. Meta mensal: calcular restante real (meta_mensal − real_mes)
    //    Usar: restanteMes = max(saldo negativo do dia, restante_mensal)
    //    Mas queremos o déficit no saldo acumulado do mês (o que precisa recuperar).
    //    Se há meta mensal, usar também esse ângulo:
    let restanteReal = restanteMes;
    if (metas.meta_mensal_min != null && metas.meta_mensal_min > 0) {
      const mesIso = hoje.slice(0, 7) + "-01";
      const { data: saldoMesRow } = await client
        .from("v_saldo_mensal")
        .select("real_min, meta_mensal_min")
        .eq("user_id", user.id)
        .eq("mes", mesIso)
        .maybeSingle();
      const realMes = (saldoMesRow as { real_min: number | null } | null)?.real_min ?? 0;
      const restanteMensal = Math.max(0, metas.meta_mensal_min - realMes);
      // Usa o maior dos dois (mais conservador — garante meta mensal)
      restanteReal = Math.max(restanteMes, restanteMensal);
    }

    // 4. Overrides futuros (para não sobrescrever folgas já definidas)
    const { data: overrideRows } = await client
      .from("metas_diarias")
      .select("data, minutos_meta")
      .eq("user_id", user.id)
      .gte("data", hoje);
    const overrides = new Map(
      ((overrideRows ?? []) as Array<{ data: string; minutos_meta: number }>)
        .map((r) => [r.data, r.minutos_meta])
    );

    // 5. Calcula proposta (puro)
    return calcularPropostaCompensacao({
      restanteMes:  restanteReal,
      hoje,
      diasEstudo:   metas.dias_estudo as number[],
      overrides,
      tetoMin:      minutosTetoCompensacao,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// aplicarCompensacao
// ---------------------------------------------------------------------------

/**
 * Aplica a compensação: grava overrides nos dias futuros e regenera o cronograma.
 * Retorna { ok, diasAplicados: number } ou { ok: false, erro }.
 */
export async function aplicarCompensacao(): Promise<
  { ok: true; diasAplicados: number } | { ok: false; erro: string }
> {
  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    // 1. Calcula proposta (reutiliza preview)
    const proposta = await previewCompensacao();
    if (!proposta) return { ok: false, erro: "Sem metas configuradas ou sem déficit." };
    if (proposta.diasPropostos.length === 0) {
      return { ok: false, erro: "Sem dias restantes para compensar." };
    }

    // 2. UPSERT overrides (metas_diarias) para cada dia proposto
    const rows = proposta.diasPropostos.map((d) => ({
      user_id:      user.id,
      data:         d.data,
      minutos_meta: d.minutosMeta,
      nota:         "compensação automática",
    }));

    const { error: upsertErr } = await client
      .from("metas_diarias")
      .upsert(rows, { onConflict: "user_id,data" });

    if (upsertErr) {
      return { ok: false, erro: `Erro ao salvar overrides: ${upsertErr.message}` };
    }

    // 3. Regenera cronograma (lê metas + novos overrides do DB)
    const regen = await regenerarCronograma();
    if (!regen.ok) {
      // Overrides já foram gravados — avisa mas não falha totalmente
      revalidatePath("/metas");
      return { ok: false, erro: `Overrides aplicados, mas falha ao regenerar cronograma: ${regen.erro}` };
    }

    revalidatePath("/metas");
    revalidatePath("/cronograma");
    revalidatePath("/plano");
    return { ok: true, diasAplicados: proposta.diasPropostos.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}
