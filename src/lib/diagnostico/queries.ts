// Wrappers tipados das views de diagnóstico (qualquer eixo/dimensão).
// Usado por RSC do dashboard — lê views genéricas, nunca tabelas cruas de gabarito.
// Nota: os tipos das views serão gerados automaticamente pelo `supabase gen types`
// após aplicar as migrations. Por ora, usamos tipos manuais alinhados com SCHEMA.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoDiagnostico } from "@/lib/types/domain";

// Tipo raw da view v_diagnostico_conteudo (espelha SCHEMA.md §3)
interface RawDiagConteudo {
  user_id: string;
  eixo: string;
  no_id: string;
  no_nome: string;
  peso_incidencia: number;
  n_feitas: number;
  n_acertos: number;
  taxa: string | number;
  volume_ok: boolean;
}

/** Nós de diagnóstico por eixo de conteúdo (matéria/subtema/micro). */
export async function fetchDiagnosticoConteudo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  userId: string
): Promise<NoDiagnostico[]> {
  const { data, error } = await client
    .from("v_diagnostico_conteudo")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(`fetchDiagnosticoConteudo: ${error.message}`);

  return ((data ?? []) as RawDiagConteudo[]).map((row) => ({
    noId: row.no_id,
    noNome: row.no_nome,
    eixo: row.eixo,
    nFeitas: row.n_feitas,
    nAcertos: row.n_acertos,
    taxa: Number(row.taxa),
    pesoIncidencia: row.peso_incidencia,
    volumeOk: row.volume_ok,
  }));
}

/** Nós de diagnóstico por dimensão transversal (EAV genérico). */
export async function fetchDiagnosticoDimensao(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  userId: string
) {
  const { data, error } = await client
    .from("v_diagnostico_dimensao")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(`fetchDiagnosticoDimensao: ${error.message}`);

  return data ?? [];
}

/** Cross-axis: taxa por subtema × dimensão. */
export async function fetchDiagnosticoCross(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  userId: string
) {
  const { data, error } = await client
    .from("v_diagnostico_cross")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(`fetchDiagnosticoCross: ${error.message}`);

  return data ?? [];
}
