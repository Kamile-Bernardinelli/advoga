// Correção de sessão — roda EXCLUSIVAMENTE no servidor (finalizeSession).
// Compara resposta_dada com gabarito usando service_role via RPC corrigir_sessao().
// Nunca exportado para client code.
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Corrige uma sessão finalizada:
 * - Chama RPC corrigir_sessao(sessao_id) no Postgres (atômica, idempotente)
 * - Retorna número de respostas corrigidas
 *
 * O RPC é definido na migration 0005_rls_single_user (Dara/@data-engineer, D-5).
 * Ele: UPDATE respostas SET correta = (resposta_dada = gabarito) + UPDATE sessoes.fim/duracao
 */
export async function corrigirSessao(sessaoId: string): Promise<void> {
  const client = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any).rpc("corrigir_sessao", {
    sessao_id: sessaoId,
  });

  if (error) {
    throw new Error(
      `corrigirSessao(${sessaoId}): ${error.message}. ` +
        "Verifique se a função RPC corrigir_sessao existe no schema Supabase (migration D-5)."
    );
  }
}
