"use server";

/**
 * Server Actions do Ambiente de Teste
 *
 * FRONTEIRA DE SEGURANÇA:
 *   - startSession, saveResposta → usam anon key + RLS
 *   - finalizeSession → usa service_role (lê gabarito, chama corrigir_sessao)
 *   - Gabarito NUNCA chega ao client antes do finalizeSession
 */

import { createActionClient } from "@/lib/supabase/action";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { z } from "zod";

// ─── startSession ────────────────────────────────────────────────────────────

const StartSessionSchema = z.object({
  exameId: z.string().uuid(),
  tipo: z.enum(["prova_oficial", "simulado", "treino"]),
});

export async function startSession(
  exameId: string,
  tipo: string
): Promise<{ sessaoId: string } | { error: string }> {
  const parsed = StartSessionSchema.safeParse({ exameId, tipo });
  if (!parsed.success) {
    return { error: "Parâmetros inválidos para iniciar sessão." };
  }

  const supabase = await createActionClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "Usuário não autenticado." };
  }

  const { data, error } = await supabase
    .from("sessoes")
    .insert({
      user_id: user.id,
      tipo: parsed.data.tipo,
      exame_id: parsed.data.exameId,
      inicio: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[startSession] Erro ao criar sessão:", error);
    return { error: "Erro ao criar sessão. Tente novamente." };
  }

  return { sessaoId: data.id };
}

// ─── saveResposta ─────────────────────────────────────────────────────────────

const SaveRespostaSchema = z.object({
  sessaoId: z.string().uuid(),
  questaoId: z.string().uuid(),
  letra: z.enum(["A", "B", "C", "D"]).nullable(),
  tempoSeg: z.number().int().min(0).max(99999),
});

export async function saveResposta(
  sessaoId: string,
  questaoId: string,
  letra: string | null,
  tempoSeg: number
): Promise<{ ok: boolean; error?: string }> {
  const parsed = SaveRespostaSchema.safeParse({ sessaoId, questaoId, letra, tempoSeg });
  if (!parsed.success) {
    return { ok: false, error: "Parâmetros inválidos." };
  }

  const supabase = await createActionClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "Usuário não autenticado." };
  }

  // UPSERT: correta = NULL (só o finalizeSession preenche correta via service_role)
  const { error } = await supabase
    .from("respostas")
    .upsert(
      {
        sessao_id: parsed.data.sessaoId,
        questao_id: parsed.data.questaoId,
        user_id: user.id,
        resposta_dada: parsed.data.letra as "A" | "B" | "C" | "D" | null,
        correta: null, // NUNCA preenche antes do finalize
        tempo_seg: parsed.data.tempoSeg,
        ts: new Date().toISOString(),
      },
      {
        onConflict: "sessao_id,questao_id",
        ignoreDuplicates: false,
      }
    );

  if (error) {
    console.error("[saveResposta] Erro:", error);
    return { ok: false, error: "Erro ao salvar resposta." };
  }

  return { ok: true };
}

// ─── startTreinoSubtema ───────────────────────────────────────────────────────

const StartTreinoSubtemaSchema = z.object({ subtemaId: z.string().uuid() });

/** Cria sessão tipo=treino escopada por subtema (exame_id=NULL). Loop do cronograma. */
export async function startTreinoSubtema(
  subtemaId: string
): Promise<{ sessaoId: string } | { error: string }> {
  const parsed = StartTreinoSubtemaSchema.safeParse({ subtemaId });
  if (!parsed.success) return { error: "Subtema inválido." };

  const supabase = await createActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Usuário não autenticado." };

  // Guard de honestidade: só cria sessão se houver questão respondível (anti-treino-vazio)
  const { count } = await supabase
    .from("questoes_prova")
    .select("id", { count: "exact", head: true })
    .eq("subtema_id", parsed.data.subtemaId);
  if (!count || count === 0) {
    return { error: "Ainda não há questões disponíveis deste subtema." };
  }

  const { data, error } = await supabase
    .from("sessoes")
    .insert({
      user_id:    user.id,
      tipo:       "treino",
      exame_id:   null,
      subtema_id: parsed.data.subtemaId,
      inicio:     new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[startTreinoSubtema] Erro:", error);
    return { error: "Erro ao iniciar treino. Tente novamente." };
  }
  return { sessaoId: data.id };
}

// ─── finalizeSession ──────────────────────────────────────────────────────────

const FinalizeSchema = z.object({
  sessaoId: z.string().uuid(),
});

export async function finalizeSession(sessaoId: string): Promise<never> {
  const parsed = FinalizeSchema.safeParse({ sessaoId });
  if (!parsed.success) {
    redirect("/teste");
  }

  // SEGURANÇA: usa service_role para chamar corrigir_sessao (lê gabarito no servidor)
  const svc = createServiceClient();

  try {
    // Chama a função SQL que corrige respostas e marca fim da sessão
    const { data, error } = await svc.rpc("corrigir_sessao", {
      p_sessao_id: parsed.data.sessaoId,
    });

    if (error) {
      console.error("[finalizeSession] Erro ao corrigir sessão:", error);
    } else {
      console.log("[finalizeSession] Correção concluída:", data);
    }
  } catch (err) {
    console.error("[finalizeSession] Erro inesperado:", err);
  }

  redirect(`/resultado/${parsed.data.sessaoId}`);
}
