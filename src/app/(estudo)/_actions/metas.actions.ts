"use server";

// Server Actions — Metas de Estudo (Cockpit v2 — Drop 1.5 v2)
//
// Contratos:
//   carregarMetas()                       → MetasEstudo | null
//   definirMetaBase(min)                  → { ok, erro? }  UPSERT singleton
//   definirMetaMensal(min | null)          → { ok, erro? }  UPSERT singleton
//   definirDiasEstudo(dias)               → { ok, erro? }  UPSERT singleton
//   definirOverrideDia(data, min, nota?)  → { ok, erro? }  UPSERT (user_id, data)
//   removerOverrideDia(data)              → { ok, erro? }  DELETE override
//
// Padrões da casa:
//   - Validação Zod na fronteira (input não confiável)
//   - auth.getUser() + user_id = user.id em todo write (RLS exige)
//   - Forma { ok, ... } (espelha planner.actions.ts)
//   - UPSERT metas_estudo por user_id; UPSERT metas_diarias por (user_id, data)

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createActionClient } from "@/lib/supabase/action";
import type { MetasEstudo, MetaDiaria } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------------------

const MinutosBaseSchema = z
  .number()
  .int("Deve ser inteiro")
  .min(0, "Mínimo 0 minutos")
  .max(1440, "Máximo 1440 minutos (24h)");

const MinutosMensalSchema = z
  .number()
  .int("Deve ser inteiro")
  .min(0)
  .max(44640, "Máximo 44640 minutos (31 dias × 24h)")
  .nullable();

const DiasEstudoSchema = z
  .array(z.number().int().min(0).max(6))
  .min(0)
  .max(7)
  .refine(
    (dias) => dias.every((d) => [0, 1, 2, 3, 4, 5, 6].includes(d)),
    "Dias inválidos — use 0 (Dom) a 6 (Sáb)"
  );

const DataISOSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD");

const MinutosMetaDiaSchema = z
  .number()
  .int("Deve ser inteiro")
  .min(0, "Mínimo 0 (folga)")
  .max(1440, "Máximo 1440 minutos");

const NotaSchema = z.string().max(500, "Nota máx. 500 chars").optional();

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

type ActionResult = { ok: true } | { ok: false; erro: string };

/** Mapeia raw DB row → MetasEstudo (domínio). */
function rowToMetasEstudo(row: {
  id: string;
  user_id: string;
  meta_base_diaria_min: number;
  meta_mensal_min: number | null;
  dias_estudo: number[];
  timezone: string;
  created_at: string;
  updated_at: string;
}): MetasEstudo {
  return {
    id:                 row.id,
    userId:             row.user_id,
    metaBaseDiariaMin:  row.meta_base_diaria_min,
    metaMensalMin:      row.meta_mensal_min,
    diasEstudo:         row.dias_estudo as number[],
    timezone:           row.timezone,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

/** Mapeia raw DB row → MetaDiaria (domínio). */
function rowToMetaDiaria(row: {
  id: string;
  user_id: string;
  data: string;
  minutos_meta: number;
  nota: string | null;
  created_at: string;
  updated_at: string;
}): MetaDiaria {
  return {
    id:          row.id,
    userId:      row.user_id,
    data:        row.data,
    minutosMeta: row.minutos_meta,
    nota:        row.nota,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// carregarMetas
// ---------------------------------------------------------------------------

/**
 * Carrega a config de metas da usuária autenticada.
 * Retorna null se não autenticada ou se ainda não tem config.
 */
export async function carregarMetas(): Promise<MetasEstudo | null> {
  try {
    const client = await createActionClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    const { data, error } = await client
      .from("metas_estudo")
      .select("id, user_id, meta_base_diaria_min, meta_mensal_min, dias_estudo, timezone, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return null;

    return rowToMetasEstudo(data as Parameters<typeof rowToMetasEstudo>[0]);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// definirMetaBase
// ---------------------------------------------------------------------------

/**
 * Define (ou atualiza) a meta base diária (min).
 * UPSERT por user_id (singleton).
 */
export async function definirMetaBase(min: number): Promise<ActionResult> {
  const parsed = MinutosBaseSchema.safeParse(min);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0].message };
  }

  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    const { error } = await client
      .from("metas_estudo")
      .upsert(
        { user_id: user.id, meta_base_diaria_min: parsed.data },
        { onConflict: "user_id" }
      );

    if (error) return { ok: false, erro: `Erro ao salvar meta base: ${error.message}` };

    revalidatePath("/plano");
    revalidatePath("/cronograma");
    revalidatePath("/metas");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// definirMetaMensal
// ---------------------------------------------------------------------------

/**
 * Define (ou remove) a meta mensal (min). null = sem meta mensal.
 */
export async function definirMetaMensal(min: number | null): Promise<ActionResult> {
  const parsed = MinutosMensalSchema.safeParse(min);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0].message };
  }

  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    const { error } = await client
      .from("metas_estudo")
      .upsert(
        { user_id: user.id, meta_mensal_min: parsed.data },
        { onConflict: "user_id" }
      );

    if (error) return { ok: false, erro: `Erro ao salvar meta mensal: ${error.message}` };

    revalidatePath("/plano");
    revalidatePath("/metas");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// definirDiasEstudo
// ---------------------------------------------------------------------------

/**
 * Define quais dias da semana são de estudo.
 * Espelha metas_estudo.dias_estudo (0=Dom..6=Sáb, igual JS getDay).
 */
export async function definirDiasEstudo(dias: number[]): Promise<ActionResult> {
  // Deduplica e ordena
  const unique = [...new Set(dias)].sort();
  const parsed = DiasEstudoSchema.safeParse(unique);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0].message };
  }

  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    const { error } = await client
      .from("metas_estudo")
      .upsert(
        { user_id: user.id, dias_estudo: parsed.data },
        { onConflict: "user_id" }
      );

    if (error) return { ok: false, erro: `Erro ao salvar dias: ${error.message}` };

    revalidatePath("/plano");
    revalidatePath("/cronograma");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// definirOverrideDia
// ---------------------------------------------------------------------------

/**
 * Define ou atualiza um override de meta para um dia específico.
 * minutos = 0 → folga explícita (vence a base; day é excluído do calendário).
 * UPSERT por (user_id, data).
 */
export async function definirOverrideDia(
  data: string,
  minutos: number,
  nota?: string
): Promise<ActionResult> {
  const parsedData   = DataISOSchema.safeParse(data);
  const parsedMin    = MinutosMetaDiaSchema.safeParse(minutos);
  const parsedNota   = NotaSchema.safeParse(nota);

  if (!parsedData.success)  return { ok: false, erro: `Data inválida: ${parsedData.error.issues[0].message}` };
  if (!parsedMin.success)   return { ok: false, erro: `Minutos inválidos: ${parsedMin.error.issues[0].message}` };
  if (!parsedNota.success)  return { ok: false, erro: `Nota inválida: ${parsedNota.error.issues[0].message}` };

  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    const { error } = await client
      .from("metas_diarias")
      .upsert(
        {
          user_id:      user.id,
          data:         parsedData.data,
          minutos_meta: parsedMin.data,
          nota:         parsedNota.data ?? null,
        },
        { onConflict: "user_id,data" }
      );

    if (error) return { ok: false, erro: `Erro ao salvar override: ${error.message}` };

    revalidatePath("/plano");
    revalidatePath("/metas");
    revalidatePath("/cronograma");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// removerOverrideDia
// ---------------------------------------------------------------------------

/**
 * Remove o override de meta de um dia específico.
 * Após remoção, o dia volta a usar a base (se for dia de estudo).
 */
export async function removerOverrideDia(data: string): Promise<ActionResult> {
  const parsedData = DataISOSchema.safeParse(data);
  if (!parsedData.success) {
    return { ok: false, erro: `Data inválida: ${parsedData.error.issues[0].message}` };
  }

  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    const { error } = await client
      .from("metas_diarias")
      .delete()
      .eq("user_id", user.id)
      .eq("data", parsedData.data);

    if (error) return { ok: false, erro: `Erro ao remover override: ${error.message}` };

    revalidatePath("/plano");
    revalidatePath("/metas");
    revalidatePath("/cronograma");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// carregarOverridesMes — carrega overrides do mês corrente para /metas
// ---------------------------------------------------------------------------

/**
 * Carrega todos os overrides do mês corrente da usuária (para /metas page).
 */
export async function carregarOverridesMes(
  mesIso: string // YYYY-MM (ex: "2026-06")
): Promise<MetaDiaria[]> {
  try {
    const client = await createActionClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return [];

    const dataIni = mesIso + "-01";
    // Último dia do mês: YYYY-MM-31 ou qualquer dia > 28 (o DB filtra correto)
    const [y, m] = mesIso.split("-").map(Number);
    const dataFim = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

    const { data, error } = await client
      .from("metas_diarias")
      .select("id, user_id, data, minutos_meta, nota, created_at, updated_at")
      .eq("user_id", user.id)
      .gte("data", dataIni)
      .lte("data", dataFim)
      .order("data");

    if (error || !data) return [];
    return (data as Parameters<typeof rowToMetaDiaria>[0][]).map(rowToMetaDiaria);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// carregarOverridesDia (helper interno exposto para saldo.actions)
// ---------------------------------------------------------------------------

/**
 * Carrega overrides futuros (data >= dataInicio) para montar o cálculo de dias restantes.
 * Retorna [] se não autenticada ou erro.
 */
export async function carregarOverridesFuturos(
  dataInicio: string
): Promise<Pick<MetaDiaria, "data" | "minutosMeta">[]> {
  try {
    const client = await createActionClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return [];

    const { data, error } = await client
      .from("metas_diarias")
      .select("data, minutos_meta")
      .eq("user_id", user.id)
      .gte("data", dataInicio);

    if (error || !data) return [];

    return (data as Array<{ data: string; minutos_meta: number }>).map((r) => ({
      data:        r.data,
      minutosMeta: r.minutos_meta,
    }));
  } catch {
    return [];
  }
}
