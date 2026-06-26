"use server";

// Server Actions — Cronograma de Estudo (Cockpit Drop 1.5)
// Contratos:
//   gerarCronograma(horasPorDia)  → DELETE pendentes gerados futuros + INSERT novos blocos
//   carregarCronograma(range)     → SELECT blocos de hoje ou semana
//   marcarBlocoFeito(id, status)  → UPDATE status de um bloco
//
// Padrões da casa:
//   - Validação Zod na fronteira
//   - auth.getUser() + user_id = user.id em todo INSERT/UPDATE
//   - Forma { ok, ... } (espelha planner.actions.ts)
//   - Preserve rule: gerarCronograma só apaga origem='gerado' E status='pendente' E data >= hoje
//     (preserva feito, em_andamento, manual e pendentes passados)

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createActionClient } from "@/lib/supabase/action";
import { gerarCronograma as calcularBlocos } from "@/lib/planner/cronograma";
import type { CronogramaBloco, BlocoStatus, NoDiagnostico } from "@/lib/types/domain";
import { dataProva } from "@/lib/planner/config";

// ---------------------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------------------

const HorasSchema = z
  .number()
  .min(0.5, "Mínimo 0.5 hora")
  .max(12, "Máximo 12 horas");

const UUIDSchema = z.string().uuid("UUID inválido");
const BlocoStatusSchema = z.enum(["pendente", "em_andamento", "feito"]);

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

const hoje = (): string => new Date().toISOString().slice(0, 10);

/** Adiciona N dias a uma data ISO. */
function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Raw rows do DB (queries com join)
interface RawMateria {
  id: string;
  nome: string;
  questoes_por_prova: number;
}

interface RawDiagNo {
  no_id: string | null;
  eixo: string | null;
  n_feitas: number | null;
  n_acertos: number | null;
  taxa: number | null;
  amostra_suficiente: boolean | null;
}

interface RawBlocoRow {
  id: string;
  user_id: string;
  data_alvo: string;
  materia_id: string;
  subtema_id: string | null;
  tipo: string;
  minutos_alvo: number;
  status: string;
  ordem: number;
  origem: string;
  created_at: string;
  updated_at: string;
  materias: { nome: string } | null;
}

/** Busca todas as matérias do catálogo (leitura authenticated). */
async function fetchMaterias(
  client: Awaited<ReturnType<typeof createActionClient>>
): Promise<RawMateria[]> {
  const { data, error } = await client
    .from("materias")
    .select("id, nome, questoes_por_prova")
    .order("nome");

  if (error) throw new Error(`fetchMaterias: ${error.message}`);
  return (data ?? []) as RawMateria[];
}

/**
 * Busca diagnóstico do usuário no nível de matéria.
 * Retorna [] se não há respostas ainda (cold-start).
 */
async function fetchDiagMateria(
  client: Awaited<ReturnType<typeof createActionClient>>,
  userId: string
): Promise<RawDiagNo[]> {
  const { data, error } = await client
    .from("diag_por_no")
    .select("no_id, eixo, n_feitas, n_acertos, taxa, amostra_suficiente")
    .eq("user_id", userId)
    .eq("eixo", "materia");

  if (error) throw new Error(`fetchDiagMateria: ${error.message}`);
  return (data ?? []) as RawDiagNo[];
}

/**
 * Merge catálogo × diagnóstico (cold-start).
 * Matérias sem histórico entram com nFeitas=0 → ordenadas por incidência pura.
 */
function mergeNos(materias: RawMateria[], diag: RawDiagNo[]): NoDiagnostico[] {
  const diagMap = new Map<string, RawDiagNo>(
    diag.filter((d) => d.no_id).map((d) => [d.no_id!, d])
  );

  return materias.map((m) => {
    const d = diagMap.get(m.id);
    return {
      noId:          m.id,
      noNome:        m.nome,
      eixo:          "materia",
      nFeitas:       d?.n_feitas    ?? 0,
      nAcertos:      d?.n_acertos   ?? 0,
      taxa:          Number(d?.taxa ?? 0),
      pesoIncidencia: m.questoes_por_prova,
      volumeOk:      d?.amostra_suficiente ?? false,
    };
  });
}

/** Transforma raw DB row → CronogramaBloco (domínio). */
function rowToBloco(row: RawBlocoRow): CronogramaBloco {
  return {
    id:          row.id,
    userId:      row.user_id,
    dataAlvo:    row.data_alvo,
    materiaId:   row.materia_id,
    subtemaId:   row.subtema_id ?? null,
    tipo:        row.tipo        as CronogramaBloco["tipo"],
    minutosAlvo: row.minutos_alvo,
    status:      row.status      as BlocoStatus,
    ordem:       row.ordem,
    origem:      row.origem      as CronogramaBloco["origem"],
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    materiaNome: row.materias?.nome ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// _carregarBlocos — função interna (sem auth check — caller valida)
// ---------------------------------------------------------------------------

async function _carregarBlocos(
  client: Awaited<ReturnType<typeof createActionClient>>,
  userId: string,
  range: "hoje" | "semana"
): Promise<CronogramaBloco[]> {
  const from = hoje();
  const to   = range === "semana" ? addDaysToDate(from, 6) : from;

  const { data, error } = await client
    .from("cronograma_blocos")
    .select(
      "id, user_id, data_alvo, materia_id, subtema_id, tipo, minutos_alvo, " +
      "status, ordem, origem, created_at, updated_at, " +
      "materias:materia_id(nome)"
    )
    .eq("user_id", userId)
    .gte("data_alvo", from)
    .lte("data_alvo", to)
    .order("data_alvo", { ascending: true })
    .order("ordem", { ascending: true });

  if (error) throw new Error(`_carregarBlocos: ${error.message}`);
  return ((data ?? []) as unknown as RawBlocoRow[]).map(rowToBloco);
}

// ---------------------------------------------------------------------------
// gerarCronograma — ação pública
// ---------------------------------------------------------------------------

/**
 * Gera (ou regenera) o cronograma de estudo.
 *
 * Algoritmo:
 *   1. Valida input (Zod)
 *   2. Busca catálogo de matérias + diagnóstico do usuário
 *   3. Merge cold-start (nós sem histórico → incidência pura)
 *   4. Chama gerador puro (lib/planner/cronograma.ts)
 *   5. DELETE blocos gerados pendentes futuros (preserva feito/manual/passados)
 *   6. INSERT novos blocos
 *   7. Retorna blocos de hoje + semana
 */
export async function gerarCronograma(
  horasPorDia: number
): Promise<{ ok: true; blocos: CronogramaBloco[] } | { ok: false; erro: string }> {
  const parsedHoras = HorasSchema.safeParse(horasPorDia);
  if (!parsedHoras.success) {
    return { ok: false, erro: parsedHoras.error.issues[0].message };
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
    const userId  = user.id;
    const dataHoje = hoje();

    // 1. Catálogo + diagnóstico em paralelo
    const [materias, diag] = await Promise.all([
      fetchMaterias(client),
      fetchDiagMateria(client, userId),
    ]);

    // 2. Merge cold-start → NoDiagnostico[]
    const nos = mergeNos(materias, diag);

    // 3a. Carrega metas da usuária para montar metaPorDiaMin + diasEstudo (§4.3 v2)
    //     Fallback gracioso: se sem metas, usa horasPorDia escalar (backward compat)
    const { data: metasRow } = await client
      .from("metas_estudo")
      .select("meta_base_diaria_min, dias_estudo")
      .eq("user_id", userId)
      .maybeSingle();

    let metaPorDiaMin: ((dataISO: string) => number) | undefined;
    let diasEstudo: number[] | undefined;

    if (metasRow) {
      const mRow = metasRow as { meta_base_diaria_min: number; dias_estudo: number[] };
      diasEstudo = mRow.dias_estudo as number[];

      // Carrega overrides futuros (metas_diarias com data >= hoje)
      const { data: overrideRows } = await client
        .from("metas_diarias")
        .select("data, minutos_meta")
        .eq("user_id", userId)
        .gte("data", dataHoje);
      const overridesMap = new Map(
        ((overrideRows ?? []) as Array<{ data: string; minutos_meta: number }>)
          .map((r) => [r.data, r.minutos_meta])
      );

      // Espelha meta_do_dia(): override → base(se dia de estudo) → 0
      metaPorDiaMin = (dataISO: string): number => {
        const override = overridesMap.get(dataISO);
        if (override !== undefined) return override;
        const dow = new Date(dataISO + "T00:00:00").getDay();
        return (diasEstudo as number[]).includes(dow) ? mRow.meta_base_diaria_min : 0;
      };
    } else {
      // Sem metas: semeia a config base com o valor informado (seed base)
      await client
        .from("metas_estudo")
        .upsert(
          { user_id: userId, meta_base_diaria_min: Math.round(parsedHoras.data * 60) },
          { onConflict: "user_id" }
        );
    }

    // 3b. Gera cronograma (puro, testável) com orçamento por dia
    const blocosGerados = calcularBlocos({
      hoje: dataHoje,
      dataProva,
      horasPorDia: parsedHoras.data,
      diasEstudo,          // de metas_estudo.dias_estudo (ou undefined → todos os dias)
      metaPorDiaMin,       // lookup por dia (ou undefined → escalar fallback)
      nos,
    });

    // 4. DELETE apenas blocos origem='gerado' E status='pendente' E data_alvo >= hoje
    //    (Preserve rule: feito, em_andamento, manual e pendentes passados são mantidos)
    const { error: delErr } = await client
      .from("cronograma_blocos")
      .delete()
      .eq("user_id", userId)
      .eq("origem", "gerado")
      .eq("status", "pendente")
      .gte("data_alvo", dataHoje);

    if (delErr) {
      return { ok: false, erro: `Erro ao limpar cronograma anterior: ${delErr.message}` };
    }

    // 5. INSERT novos blocos
    if (blocosGerados.length > 0) {
      const rows = blocosGerados.map((b) => ({
        user_id:    userId,
        data_alvo:  b.dataAlvo,
        materia_id: b.noId, // Fatia 1: eixo='materia' → noId = materiaId
        subtema_id: null as string | null,
        tipo:       b.tipo,
        minutos_alvo: b.minutosAlvo,
        ordem:      b.ordem,
        status:     "pendente" as const,
        origem:     "gerado"  as const,
      }));

      const { error: insErr } = await client
        .from("cronograma_blocos")
        .insert(rows);

      if (insErr) {
        return { ok: false, erro: `Erro ao salvar blocos: ${insErr.message}` };
      }
    }

    // 6. Revalida a RSC de /cronograma + retorna blocos da semana
    revalidatePath("/cronograma");
    const blocos = await _carregarBlocos(client, userId, "semana");
    return { ok: true, blocos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro ao gerar cronograma: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// carregarCronograma — ação pública
// ---------------------------------------------------------------------------

/**
 * Carrega blocos do cronograma (hoje ou semana).
 * Retorna [] se não autenticada.
 */
export async function carregarCronograma(
  range: "hoje" | "semana"
): Promise<CronogramaBloco[]> {
  try {
    const client = await createActionClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return [];
    return _carregarBlocos(client, user.id, range);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// marcarBlocoFeito — ação pública
// ---------------------------------------------------------------------------

/**
 * Atualiza o status de um bloco de cronograma.
 * RLS garante que só a dona do bloco pode atualizar.
 */
export async function marcarBlocoFeito(
  blocoId: string,
  status: BlocoStatus
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const parsedId     = UUIDSchema.safeParse(blocoId);
  const parsedStatus = BlocoStatusSchema.safeParse(status);

  if (!parsedId.success) {
    return { ok: false, erro: `ID inválido: ${parsedId.error.issues[0].message}` };
  }
  if (!parsedStatus.success) {
    return { ok: false, erro: `Status inválido: ${parsedStatus.error.issues[0].message}` };
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

    const { error } = await client
      .from("cronograma_blocos")
      .update({ status: parsedStatus.data, updated_at: new Date().toISOString() })
      .eq("id", parsedId.data)
      .eq("user_id", user.id); // garante que só atualiza o próprio bloco

    if (error) {
      return { ok: false, erro: `Erro ao atualizar bloco: ${error.message}` };
    }

    // Revalida a RSC de /cronograma para refletir o novo status do bloco.
    revalidatePath("/cronograma");

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro inesperado: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// regenerarCronograma — re-plan sem parâmetro (lê meta base do DB)
// ---------------------------------------------------------------------------

/**
 * Regenera o cronograma lendo horasPorDia diretamente de metas_estudo.
 * Usado pela compensação (após gravar overrides) e pelo botão "Regenerar" em /metas.
 * Fallback: minutosPorDiaDefault (180 min = 3h) se sem metas.
 */
export async function regenerarCronograma(): Promise<
  { ok: true; blocos: CronogramaBloco[] } | { ok: false; erro: string }
> {
  try {
    const client = await createActionClient();
    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) return { ok: false, erro: "Usuária não autenticada." };

    const { data: metasRow } = await client
      .from("metas_estudo")
      .select("meta_base_diaria_min")
      .eq("user_id", user.id)
      .maybeSingle();

    const metaBase = (metasRow as { meta_base_diaria_min: number } | null)
      ?.meta_base_diaria_min ?? 180;

    // Reutiliza gerarCronograma com horasPorDia = metaBase / 60
    return gerarCronograma(metaBase / 60);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro ao regenerar cronograma: ${msg}` };
  }
}
