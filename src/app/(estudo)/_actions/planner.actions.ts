"use server";

// Server Actions — Ambiente de Estudo / Planner v1
// AC-1.6.1 a AC-1.6.9 (Story 1.6)
//
// Fluxo:
//   1. busca nós de diagnóstico (view diag_weakness_score, eixo='materia')
//   2. busca respostas erradas nas últimas 2 sessões → boosts de repetição espaçada
//   3. chama lib/planner/planner.ts (lógica PURA)
//   4. persiste em plano_diario (UPSERT por user_id+data — AC-1.6.7)
//   5. retorna PlanoDiario para o client renderizar

import { createActionClient } from "@/lib/supabase/action";
import { gerarPlano, type SubtemaBoost } from "@/lib/planner/planner";
import type { NoDiagnostico, PlanoDiario } from "@/lib/types/domain";

// Tipo raw da view diag_weakness_score (subset dos campos que o planner precisa)
interface RawWeaknessScore {
  user_id: string;
  eixo: string;
  no_id: string;
  no_nome: string;
  n_feitas: number;
  n_acertos: number;
  taxa: number | string;
  amostra_suficiente: boolean;
  peso_incidencia: number | null;
  weakness_score: number | string | null;
}

// Tipo raw da query de respostas erradas recentes
interface RawRespostaErrada {
  materia_id: string;
}

/**
 * Busca os nós de diagnóstico por matéria (eixo='materia') para o usuário autenticado.
 * Fonte: view diag_weakness_score (já calcula o score no SQL — §8.3 do brief).
 */
async function fetchNosMateria(
  client: Awaited<ReturnType<typeof createActionClient>>,
  userId: string
): Promise<NoDiagnostico[]> {
  const { data, error } = await client
    .from("diag_weakness_score")
    .select("user_id, eixo, no_id, no_nome, n_feitas, taxa, amostra_suficiente, peso_incidencia")
    .eq("user_id", userId)
    .eq("eixo", "materia");

  if (error) throw new Error(`fetchNosMateria: ${error.message}`);

  return ((data ?? []) as RawWeaknessScore[]).map((row) => ({
    noId: row.no_id,
    noNome: row.no_nome,
    eixo: row.eixo,
    nFeitas: row.n_feitas,
    nAcertos: 0, // não precisamos para o planner
    taxa: Number(row.taxa),
    pesoIncidencia: Number(row.peso_incidencia ?? 1),
    volumeOk: row.amostra_suficiente,
  }));
}

/**
 * Busca matérias erradas nas últimas 2 sessões finalizadas.
 * Usado para calcular o boost de repetição espaçada (AC-1.6.5).
 *
 * Retorna um Set de materia_id com erro nas últimas 2 sessões.
 */
async function fetchMateriaErradasRecentesBoosts(
  client: Awaited<ReturnType<typeof createActionClient>>,
  userId: string
): Promise<SubtemaBoost[]> {
  // Busca IDs das últimas 2 sessões finalizadas (fim IS NOT NULL e correcao concluída)
  const { data: sessoes, error: errSessoes } = await client
    .from("sessoes")
    .select("id")
    .eq("user_id", userId)
    .not("fim", "is", null)
    .order("inicio", { ascending: false })
    .limit(2);

  if (errSessoes || !sessoes || sessoes.length === 0) return [];

  const sessaoIds = sessoes.map((s) => s.id as string);

  // Busca respostas erradas dessas sessões + materia_id via join com questoes
  const { data: erradas, error: errResp } = await client
    .from("respostas")
    .select("materia_id:questoes(materia_id)")
    .in("sessao_id", sessaoIds)
    .eq("correta", false);

  if (errResp || !erradas) return [];

  // Conta quantas vezes cada matéria apareceu com erro
  const contagemErros = new Map<string, number>();
  for (const row of erradas as unknown as RawRespostaErrada[]) {
    const mid = row.materia_id;
    if (mid) {
      contagemErros.set(mid, (contagemErros.get(mid) ?? 0) + 1);
    }
  }

  // Converte para boosts: cada matéria errada recebe +20% (AC-1.6.5)
  return Array.from(contagemErros.entries()).map(([noId]) => ({
    noId,
    multiplicador: 1.2, // +20% conforme AC-1.6.5
  }));
}

/**
 * Salva ou atualiza o plano do dia em plano_diario.
 * UPSERT por (user_id, data) — mantém histórico ao não deletar registros antigos.
 * AC-1.6.7 + AC-1.6.9.
 */
async function salvarPlano(
  client: Awaited<ReturnType<typeof createActionClient>>,
  userId: string,
  plano: PlanoDiario
): Promise<void> {
  const { error } = await client.from("plano_diario").upsert(
    {
      user_id: userId,
      data: plano.data,
      horas: plano.horas,
      questoes_alvo: plano.questoesAlvo,
      distribuicao_json: plano.distribuicao as unknown as import("@/lib/types/db.types").Json,
      gerado_em: plano.geradoEm,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,data",
    }
  );

  if (error) throw new Error(`salvarPlano: ${error.message}`);
}

/**
 * Carrega o plano do dia atual (se já gerado).
 * Usado pelo RSC da página /plano para mostrar plano existente.
 */
export async function carregarPlanoDoDia(): Promise<PlanoDiario | null> {
  const client = await createActionClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const hoje = new Date().toISOString().slice(0, 10);

  const { data, error } = await client
    .from("plano_diario")
    .select("data, horas, questoes_alvo, distribuicao_json, gerado_em")
    .eq("user_id", user.id)
    .eq("data", hoje)
    .maybeSingle();

  if (error || !data) return null;

  return {
    data: data.data as string,
    horas: Number(data.horas),
    questoesAlvo: Number(data.questoes_alvo),
    distribuicao: (data.distribuicao_json as unknown as PlanoDiario["distribuicao"]) ?? [],
    geradoEm: data.gerado_em as string,
  };
}

/**
 * Gera o plano diário de questões e persiste em plano_diario.
 *
 * AC-1.6.1: aceita horas (decimal, default 3)
 * AC-1.6.2: questoes_alvo = horas × 30 (QUESTIONS_PER_HOUR)
 * AC-1.6.3: distribuição por incidência × weakness (matérias sem gate = medir)
 * AC-1.6.4: Ética sempre presente, dose mínima 10%
 * AC-1.6.5: repetição espaçada: matérias erradas nas últimas 2 sessões = +20%
 * AC-1.6.7: persiste em plano_diario
 */
export async function gerarPlanoDiario(
  horas: number
): Promise<{ ok: true; plano: PlanoDiario } | { ok: false; erro: string }> {
  try {
    // Valida input
    const horasValidas = Math.max(0.5, Math.min(12, horas));

    const client = await createActionClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { ok: false, erro: "Usuária não autenticada." };
    }

    const userId = user.id;
    const hoje = new Date().toISOString().slice(0, 10);

    // 1. Busca nós de diagnóstico (matéria level)
    const nos = await fetchNosMateria(client, userId);

    // 2. Boosts de repetição espaçada (últimas 2 sessões)
    const subtemaBoosts = await fetchMateriaErradasRecentesBoosts(client, userId);

    // 3. Gera plano (lógica pura — testável)
    const plano = gerarPlano({
      horas: horasValidas,
      nos,
      data: hoje,
      subtemaBoosts,
    });

    // 4. Persiste
    await salvarPlano(client, userId, plano);

    return { ok: true, plano };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Erro ao gerar plano: ${msg}` };
  }
}
