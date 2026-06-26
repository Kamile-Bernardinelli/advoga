"use server";

// Server Actions — Saldo de Estudo (Cockpit v2 — Drop 1.5 v2)
//
// Contratos:
//   carregarSaldoDiario(range)  → SaldoDia[]   (semana ou mês)
//   carregarSaldoMensal()       → SaldoMes | null  (mês corrente)
//   carregarAderenciaHoje()     → AderenciaHoje | null  (header do /plano)
//
// Fato em SQL, recomendação no app:
//   - v_saldo_diario + v_saldo_mensal entregam os fatos (real/meta/saldo)
//   - saldo.ts (puro) calcula dias restantes, ritmo e status
//   - "hoje" é calculado no fuso da usuária (hojeLocal(tz)) — §8 corretude

import { createActionClient } from "@/lib/supabase/action";
import {
  hojeLocal,
  montarAderenciaHoje,
} from "@/lib/metas/saldo";
import { carregarOverridesFuturos } from "@/app/(estudo)/_actions/metas.actions";
import type { SaldoDia, SaldoMes, AderenciaHoje } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Helpers de mapeamento (raw view → domínio)
// ---------------------------------------------------------------------------

interface RawSaldoDiario {
  dia: string | null;
  meta_min: number | null;
  real_min: number | null;
  n_sessoes: number | null;
  saldo_dia: number | null;
  saldo_acum_semana: number | null;
  saldo_acum_mes: number | null;
  saldo_acum_total: number | null;
}

interface RawSaldoMensal {
  mes: string | null;
  meta_mensal_min: number | null;
  real_min: number | null;
  n_sessoes: number | null;
  saldo_mes: number | null;
  pct_meta: number | null;
}

function rowToSaldoDia(r: RawSaldoDiario): SaldoDia {
  return {
    dia:             r.dia ?? "",
    metaMin:         r.meta_min ?? 0,
    realMin:         r.real_min ?? 0,
    nSessoes:        r.n_sessoes ?? 0,
    saldoDia:        r.saldo_dia ?? 0,
    saldoAcumSemana: r.saldo_acum_semana ?? 0,
    saldoAcumMes:    r.saldo_acum_mes ?? 0,
    saldoAcumTotal:  r.saldo_acum_total ?? 0,
  };
}

function rowToSaldoMes(r: RawSaldoMensal): SaldoMes {
  return {
    mes:           r.mes ?? "",
    metaMensalMin: r.meta_mensal_min,
    realMin:       r.real_min ?? 0,
    nSessoes:      r.n_sessoes ?? 0,
    saldoMes:      r.saldo_mes ?? 0,
    pctMeta:       r.pct_meta,
  };
}

// ---------------------------------------------------------------------------
// carregarSaldoDiario
// ---------------------------------------------------------------------------

/**
 * Carrega os saldos diários da usuária para os últimos N dias.
 *
 * range = "semana" → últimos 7 dias
 * range = "mes"    → últimos 30 dias (corrente)
 *
 * Retorna [] se não autenticada.
 */
export async function carregarSaldoDiario(
  range: "semana" | "mes"
): Promise<SaldoDia[]> {
  try {
    const client = await createActionClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return [];

    // Busca timezone da usuária para calcular o "hoje" correto
    const { data: metasRow } = await client
      .from("metas_estudo")
      .select("timezone")
      .eq("user_id", user.id)
      .maybeSingle();
    const tz = (metasRow as { timezone: string } | null)?.timezone ?? "America/Sao_Paulo";
    const hoje = hojeLocal(tz);

    // Calcula a data de início do range
    const diasAtras = range === "semana" ? 6 : 29;
    const dataIni = subtractDays(hoje, diasAtras);

    const { data, error } = await client
      .from("v_saldo_diario")
      .select("dia, meta_min, real_min, n_sessoes, saldo_dia, saldo_acum_semana, saldo_acum_mes, saldo_acum_total")
      .eq("user_id", user.id)
      .gte("dia", dataIni)
      .lte("dia", hoje)
      .order("dia", { ascending: true });

    if (error || !data) return [];
    return (data as RawSaldoDiario[]).map(rowToSaldoDia);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// carregarSaldoMensal
// ---------------------------------------------------------------------------

/**
 * Carrega o saldo do mês corrente.
 * Retorna null se não autenticada ou sem sessões no mês.
 * A UI trata null como real_mes=0, pct_meta=0.
 */
export async function carregarSaldoMensal(): Promise<SaldoMes | null> {
  try {
    const client = await createActionClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    const { data: metasRow } = await client
      .from("metas_estudo")
      .select("timezone, meta_mensal_min")
      .eq("user_id", user.id)
      .maybeSingle();
    const tz = (metasRow as { timezone: string; meta_mensal_min: number | null } | null)?.timezone ?? "America/Sao_Paulo";
    const hoje = hojeLocal(tz);
    const mesIso = hoje.slice(0, 7) + "-01"; // primeiro dia do mês corrente

    const { data, error } = await client
      .from("v_saldo_mensal")
      .select("mes, meta_mensal_min, real_min, n_sessoes, saldo_mes, pct_meta")
      .eq("user_id", user.id)
      .eq("mes", mesIso)
      .maybeSingle();

    if (error || !data) return null;
    return rowToSaldoMes(data as RawSaldoMensal);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// carregarAderenciaHoje
// ---------------------------------------------------------------------------

/**
 * Monta o cabeçalho de aderência para o cockpit /plano:
 *   - Fatos do DB: meta/real/saldo de hoje + acumulado do mês + progresso mensal
 *   - Recomendações (saldo.ts): dias restantes, ritmo necessário, status
 *
 * Retorna null se não autenticada ou sem metas configuradas.
 */
export async function carregarAderenciaHoje(): Promise<AderenciaHoje | null> {
  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return null;

    // 1. Metas da usuária (diasEstudo, base, mensal, timezone)
    const { data: metasRow } = await client
      .from("metas_estudo")
      .select("meta_base_diaria_min, meta_mensal_min, dias_estudo, timezone")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!metasRow) return null; // Sem metas configuradas → null (UI pede pra configurar)

    const metas = metasRow as {
      meta_base_diaria_min: number;
      meta_mensal_min: number | null;
      dias_estudo: number[];
      timezone: string;
    };
    const tz   = metas.timezone;
    const hoje = hojeLocal(tz);

    // 2. Saldo de hoje (fato do DB, no fuso correto)
    const { data: saldoHojeRow } = await client
      .from("v_saldo_diario")
      .select("meta_min, real_min, saldo_dia, saldo_acum_mes")
      .eq("user_id", user.id)
      .eq("dia", hoje)
      .maybeSingle();

    // 3. Saldo mensal (fato do DB)
    const mesIso = hoje.slice(0, 7) + "-01";
    const { data: saldoMesRow } = await client
      .from("v_saldo_mensal")
      .select("real_min, meta_mensal_min")
      .eq("user_id", user.id)
      .eq("mes", mesIso)
      .maybeSingle();

    // 4. Overrides futuros (para calcular dias restantes com precisão)
    const overrideRows = await carregarOverridesFuturos(hoje);
    const overridesMap = new Map(overrideRows.map((r) => [r.data, r.minutosMeta]));

    // 5. Extrai os fatos (defaults seguros se sem sessão ainda)
    const saldoHoje = saldoHojeRow as {
      meta_min: number | null;
      real_min: number | null;
      saldo_dia: number | null;
      saldo_acum_mes: number | null;
    } | null;

    const saldoMes = saldoMesRow as {
      real_min: number | null;
      meta_mensal_min: number | null;
    } | null;

    const metaHojeMin    = saldoHoje?.meta_min    ?? 0;
    const realHojeMin    = saldoHoje?.real_min     ?? 0;
    const saldoHojeMin   = saldoHoje?.saldo_dia    ?? (0 - metaHojeMin);
    const saldoAcumMesMin = saldoHoje?.saldo_acum_mes ?? (0 - metaHojeMin);
    const realMesMin     = saldoMes?.real_min      ?? 0;
    const metaMensalMin  = saldoMes?.meta_mensal_min ?? metas.meta_mensal_min;

    // 6. Calcula recomendações (saldo.ts puro)
    return montarAderenciaHoje({
      metaHojeMin,
      realHojeMin,
      saldoHojeMin,
      saldoAcumMesMin,
      realMesMin,
      metaMensalMin,
      metaBaseDiariaMin: metas.meta_base_diaria_min,
      diasEstudo: metas.dias_estudo as number[],
      overrides: overridesMap,
      hoje,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper interno
// ---------------------------------------------------------------------------

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
