// Wrappers tipados sobre as views reais de diagnóstico (diag_*).
// Não está wired em nenhum RSC no momento — superfícies live leem as views
// diretamente; este módulo é a camada canônica de query para Drop-2 conectar.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoDiagnostico } from "@/lib/types/domain";

// Tipo raw da view diag_weakness_score (subset dos campos que o mapeamento precisa)
interface RawWeaknessScore {
  user_id: string;
  eixo: string;
  no_id: string;
  no_nome: string;
  n_feitas: number;
  taxa: number | string;
  amostra_suficiente: boolean;
  peso_incidencia: number | null;
}

// Tipo raw da view diag_cross_subtema_dimensao
interface RawCrossRow {
  user_id: string;
  subtema_id: string;
  subtema_nome: string;
  materia_id: string;
  dimensao_chave: string;
  dimensao_nome: string;
  valor_id: string;
  valor_nome: string;
  n_feitas: number;
  n_acertos: number;
  taxa: number | string;
  amostra_suficiente: boolean;
  gate_minimo: number | null;
  ultimo_ts: string | null;
  atualizado_em: string;
}

/**
 * Nós de diagnóstico por weakness score — repontado de v_diagnostico_conteudo
 * (inexistente) para diag_weakness_score (view real, Drop-1).
 * nAcertos = 0 porque diag_weakness_score não expõe o total de acertos;
 * usar diag_por_no se a contagem de acertos for necessária (Drop-2).
 */
export async function fetchDiagnosticoConteudo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  userId: string
): Promise<NoDiagnostico[]> {
  const { data, error } = await client
    .from("diag_weakness_score")
    .select("user_id, eixo, no_id, no_nome, n_feitas, taxa, amostra_suficiente, peso_incidencia")
    .eq("user_id", userId);

  if (error) throw new Error(`fetchDiagnosticoConteudo: ${error.message}`);

  return ((data ?? []) as RawWeaknessScore[]).map((row) => ({
    noId: row.no_id,
    noNome: row.no_nome,
    eixo: row.eixo,
    nFeitas: row.n_feitas,
    nAcertos: 0, // não presente em diag_weakness_score — usar diag_por_no (Drop-2)
    taxa: Number(row.taxa),
    pesoIncidencia: Number(row.peso_incidencia ?? 1),
    volumeOk: row.amostra_suficiente,
  }));
}

/**
 * Cross-axis: taxa por subtema × dimensão — repontado de v_diagnostico_cross
 * (inexistente) para diag_cross_subtema_dimensao (view real, Drop-1).
 */
export async function fetchDiagnosticoCross(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  userId: string
): Promise<RawCrossRow[]> {
  const { data, error } = await client
    .from("diag_cross_subtema_dimensao")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(`fetchDiagnosticoCross: ${error.message}`);

  return (data ?? []) as RawCrossRow[];
}

/**
 * Diagnóstico agregado por (dimensão, valor) — repontado de v_diagnostico_dimensao
 * (inexistente) para diag_cross_subtema_dimensao com agregação em JS.
 *
 * TODO Drop-2: criar view diag_por_dimensao dedicada no SQL para eliminar
 * a agregação em JS e reduzir o payload transferido pelo cliente.
 */
export async function fetchDiagnosticoDimensao(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  userId: string
): Promise<
  {
    dimensaoChave: string;
    dimensaoNome: string;
    valorNome: string;
    nFeitas: number;
    nAcertos: number;
    taxa: number;
  }[]
> {
  const { data, error } = await client
    .from("diag_cross_subtema_dimensao")
    .select("dimensao_chave, dimensao_nome, valor_nome, n_feitas, n_acertos")
    .eq("user_id", userId);

  if (error) throw new Error(`fetchDiagnosticoDimensao: ${error.message}`);

  type RawDimRow = Pick<
    RawCrossRow,
    "dimensao_chave" | "dimensao_nome" | "valor_nome" | "n_feitas" | "n_acertos"
  >;

  // Agrega por (dimensao_chave, valor_nome): soma n_feitas + n_acertos entre subtemas
  const agg = new Map<
    string,
    { dimensaoChave: string; dimensaoNome: string; valorNome: string; nFeitas: number; nAcertos: number }
  >();

  for (const row of (data ?? []) as RawDimRow[]) {
    const key = `${row.dimensao_chave}:${row.valor_nome}`;
    const existing = agg.get(key);
    if (existing) {
      existing.nFeitas += row.n_feitas;
      existing.nAcertos += row.n_acertos;
    } else {
      agg.set(key, {
        dimensaoChave: row.dimensao_chave,
        dimensaoNome: row.dimensao_nome,
        valorNome: row.valor_nome,
        nFeitas: row.n_feitas,
        nAcertos: row.n_acertos,
      });
    }
  }

  return Array.from(agg.values()).map((entry) => ({
    ...entry,
    taxa: entry.nFeitas > 0 ? entry.nAcertos / entry.nFeitas : 0,
  }));
}
