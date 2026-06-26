"use server";

// Server Actions — Registro de Estudo (Cockpit Drop 1.5)
// Contratos:
//   registrarEstudo  → INSERT estudo_sessoes (Fatia 1: entrada manual sem timer)
//   listarEstudoRecente → SELECT últimos registros da usuária
//
// Padrões da casa:
//   - Validação Zod na fronteira (input não confiável)
//   - auth.getUser() + user_id = user.id em todo INSERT (RLS exige)
//   - Forma { ok, ... } (espelha planner.actions.ts)

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createActionClient } from "@/lib/supabase/action";
import type { EstudoSessao, TipoEstudo } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------------------

const UUIDSchema = z.string().uuid("UUID inválido");

const RegistrarEstudoSchema = z.object({
  materiaId:      UUIDSchema,
  subtemaId:      UUIDSchema.optional(),
  microTopicoId:  UUIDSchema.optional(),
  materialId:     UUIDSchema.optional(),
  local:          z.string().max(200).optional(),
  tipoEstudo:     z.enum(["leitura", "video", "resumo", "revisao", "questoes", "outro"]),
  minutos:        z.number().int("Deve ser número inteiro").min(1, "Mínimo 1 minuto").max(720, "Máximo 720 minutos"),
  anotacao:       z.string().max(2000).optional(),
  inicio:         z.string().optional(), // ISO timestamp — Fatia 2 (timer)
  fim:            z.string().optional(), // ISO timestamp — Fatia 2 (timer)
});

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type RegistrarEstudoInput = {
  materiaId:     string;
  subtemaId?:    string;
  microTopicoId?: string;
  materialId?:   string;
  local?:        string;
  tipoEstudo:    TipoEstudo;
  minutos:       number;
  anotacao?:     string;
  inicio?:       string;
  fim?:          string;
};

// ---------------------------------------------------------------------------
// registrarEstudo
// ---------------------------------------------------------------------------

/**
 * Registra uma sessão de estudo manual.
 *
 * Fatia 1: entrada sem timer (minutos informados diretamente pelo usuário).
 * RLS garante que só a usuária autenticada pode inserir com seu user_id.
 */
export async function registrarEstudo(
  input: RegistrarEstudoInput
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  // Validação de input (fronteira — input não confiável)
  const parsed = RegistrarEstudoSchema.safeParse(input);
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, erro: msgs };
  }
  const data = parsed.data;

  // Trust boundary (§8 do spec): quando inicio+fim chegam (caminho timer),
  // o servidor RECOMPUTA duracao_min = round((fim − inicio)/60000).
  // O cliente passa minutos como fallback de validação Zod; aqui sobrescrevemos.
  let minutosCanonical = data.minutos;
  if (data.inicio && data.fim) {
    const diff = Math.round(
      (new Date(data.fim).getTime() - new Date(data.inicio).getTime()) / 60000
    );
    if (diff >= 1) minutosCanonical = Math.min(diff, 720);
  }

  try {
    const client = await createActionClient();
    const {
      data: { user },
      error: authErr,
    } = await client.auth.getUser();

    if (authErr || !user) {
      return { ok: false, erro: "Usuária não autenticada." };
    }

    const { data: row, error } = await client
      .from("estudo_sessoes")
      .insert({
        user_id:        user.id,
        materia_id:     data.materiaId,
        subtema_id:     data.subtemaId      ?? null,
        micro_topico_id: data.microTopicoId ?? null,
        material_id:    data.materialId     ?? null,
        local:          data.local          ?? null,
        tipo_estudo:    data.tipoEstudo,
        duracao_min:    minutosCanonical,   // recomputado do timer se inicio+fim presentes
        anotacao:       data.anotacao       ?? null,
        inicio:         data.inicio         ?? null,
        fim:            data.fim            ?? null,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, erro: `Erro ao registrar sessão: ${error.message}` };
    }

    // Revalida a RSC de /registro + /plano (saldo header atualiza após nova sessão).
    revalidatePath("/registro");
    revalidatePath("/plano");

    return { ok: true, id: (row as { id: string }).id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// listarEstudoRecente
// ---------------------------------------------------------------------------

/** Raw row da query (join materias → nome). */
interface RawEstudoRow {
  id: string;
  user_id: string;
  materia_id: string;
  subtema_id: string | null;
  micro_topico_id: string | null;
  material_id: string | null;
  local: string | null;
  tipo_estudo: string;
  inicio: string | null;
  fim: string | null;
  duracao_min: number;
  anotacao: string | null;
  ts: string;
  created_at: string;
  updated_at: string;
  materias: { nome: string } | null;
}

/**
 * Lista os registros de estudo mais recentes da usuária autenticada.
 * Retorna [] se não autenticada (silencioso — usado em RSC para display inicial).
 */
export async function listarEstudoRecente(limit = 20): Promise<EstudoSessao[]> {
  try {
    const client = await createActionClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return [];

    const { data, error } = await client
      .from("estudo_sessoes")
      .select(
        "id, user_id, materia_id, subtema_id, micro_topico_id, material_id, " +
        "local, tipo_estudo, inicio, fim, duracao_min, anotacao, ts, created_at, updated_at, " +
        "materias:materia_id(nome)"
      )
      .eq("user_id", user.id)
      .order("ts", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return (data as unknown as RawEstudoRow[]).map((row) => ({
      id:             row.id,
      userId:         row.user_id,
      materiaId:      row.materia_id,
      subtemaId:      row.subtema_id     ?? null,
      microTopicoId:  row.micro_topico_id ?? null,
      materialId:     row.material_id    ?? null,
      local:          row.local          ?? null,
      tipoEstudo:     row.tipo_estudo    as TipoEstudo,
      inicio:         row.inicio         ?? null,
      fim:            row.fim            ?? null,
      duracaoMin:     row.duracao_min,
      anotacao:       row.anotacao       ?? null,
      ts:             row.ts,
      createdAt:      row.created_at,
      updatedAt:      row.updated_at,
      materiaNome:    row.materias?.nome ?? undefined,
    }));
  } catch {
    return [];
  }
}
