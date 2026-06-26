"use server";

// Server Actions — Catálogo de Materiais (Cockpit Fatia B)
//
// Contratos:
//   listarMateriais()             → Material[]
//   criarMaterial(input)          → { ok, id } | { ok: false, erro }
//   atualizarMaterial(id, input)  → { ok } | { ok: false, erro }
//   removerMaterial(id)           → { ok } | { ok: false, erro }
//
// Padrões da casa:
//   - Validação Zod na fronteira
//   - auth.getUser() + user_id em todo write
//   - Forma { ok, ... }
//   - UNIQUE(user_id, nome) — não duplicar material

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createActionClient } from "@/lib/supabase/action";
import type { Material, MaterialTipo } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------------------

const NomeSchema = z
  .string()
  .trim()
  .min(1, "Nome obrigatório")
  .max(200, "Nome máx. 200 chars");

const TipoSchema = z.enum([
  "livro", "pdf", "video", "curso", "lei", "resumo", "outro",
]);

const ReferenciaSchema = z
  .string()
  .max(500, "Referência máx. 500 chars")
  .optional()
  .nullable();

const UUIDSchema = z.string().uuid("UUID inválido");

const MaterialInputSchema = z.object({
  nome:       NomeSchema,
  tipo:       TipoSchema,
  referencia: ReferenciaSchema,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ActionResult = { ok: true; id?: string } | { ok: false; erro: string };

interface RawMaterial {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  referencia: string | null;
  created_at: string;
  updated_at: string;
}

function rowToMaterial(r: RawMaterial): Material {
  return {
    id:         r.id,
    userId:     r.user_id,
    nome:       r.nome,
    tipo:       r.tipo as MaterialTipo,
    referencia: r.referencia,
    createdAt:  r.created_at,
    updatedAt:  r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// listarMateriais
// ---------------------------------------------------------------------------

/**
 * Retorna todos os materiais da usuária autenticada, ordenados por nome.
 */
export async function listarMateriais(): Promise<Material[]> {
  try {
    const client = await createActionClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return [];

    const { data, error } = await client
      .from("materiais")
      .select("id, user_id, nome, tipo, referencia, created_at, updated_at")
      .eq("user_id", user.id)
      .order("nome");

    if (error || !data) return [];
    return (data as RawMaterial[]).map(rowToMaterial);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// criarMaterial
// ---------------------------------------------------------------------------

/**
 * Cria um novo material no catálogo da usuária.
 * Retorna { ok: true, id } ou { ok: false, erro } (duplicata → erro amigável).
 */
export async function criarMaterial(input: {
  nome: string;
  tipo: string;
  referencia?: string | null;
}): Promise<ActionResult> {
  const parsed = MaterialInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0].message };
  }

  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    const { data, error } = await client
      .from("materiais")
      .insert({
        user_id:    user.id,
        nome:       parsed.data.nome,
        tipo:       parsed.data.tipo,
        referencia: parsed.data.referencia ?? null,
      })
      .select("id")
      .single();

    if (error) {
      // Constraint de unicidade (user_id, nome)
      if (error.code === "23505") {
        return { ok: false, erro: `Já existe um material com o nome "${parsed.data.nome}".` };
      }
      return { ok: false, erro: `Erro ao criar material: ${error.message}` };
    }

    revalidatePath("/materiais");
    revalidatePath("/registro");
    return { ok: true, id: (data as { id: string }).id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// atualizarMaterial
// ---------------------------------------------------------------------------

/**
 * Atualiza nome/tipo/referencia de um material da usuária.
 */
export async function atualizarMaterial(
  id: string,
  input: { nome: string; tipo: string; referencia?: string | null }
): Promise<ActionResult> {
  const parsedId  = UUIDSchema.safeParse(id);
  const parsedIn  = MaterialInputSchema.safeParse(input);

  if (!parsedId.success) return { ok: false, erro: `ID inválido: ${parsedId.error.issues[0].message}` };
  if (!parsedIn.success)  return { ok: false, erro: parsedIn.error.issues[0].message };

  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    const { error } = await client
      .from("materiais")
      .update({
        nome:       parsedIn.data.nome,
        tipo:       parsedIn.data.tipo,
        referencia: parsedIn.data.referencia ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsedId.data)
      .eq("user_id", user.id); // RLS + garante dono

    if (error) {
      if (error.code === "23505") {
        return { ok: false, erro: `Já existe um material com o nome "${parsedIn.data.nome}".` };
      }
      return { ok: false, erro: `Erro ao atualizar material: ${error.message}` };
    }

    revalidatePath("/materiais");
    revalidatePath("/registro");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// removerMaterial
// ---------------------------------------------------------------------------

/**
 * Remove um material do catálogo (ON DELETE SET NULL em estudo_sessoes → não perde sessões).
 */
export async function removerMaterial(id: string): Promise<ActionResult> {
  const parsedId = UUIDSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, erro: `ID inválido: ${parsedId.error.issues[0].message}` };

  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    const { error } = await client
      .from("materiais")
      .delete()
      .eq("id", parsedId.data)
      .eq("user_id", user.id);

    if (error) return { ok: false, erro: `Erro ao remover material: ${error.message}` };

    revalidatePath("/materiais");
    revalidatePath("/registro");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}
