"use server";

// Server Action de leitura — Desempenho por Característica da Questão (Drop 2)
// Lê diag_cross_subtema_dimensao, agrega por (dimensaoChave, valorNome) e classifica.
// Anti-chute §4: a classificação e o gate ocorrem na lib PURA (cross.ts) — nunca aqui.

import { createActionClient } from "@/lib/supabase/action";
import {
  agregarCaracteristicas,
  type CaracteristicaDesempenho,
} from "@/lib/diagnostico/cross";
import type { Database } from "@/lib/types/db.types";

type CrossRow =
  Database["public"]["Views"]["diag_cross_subtema_dimensao"]["Row"];

/**
 * Carrega e agrega o desempenho por característica da questão para o usuário autenticado.
 *
 * @returns Array de CaracteristicaDesempenho ordenado (pior primeiro, medindo por último).
 *          Retorna [] se não autenticado, sem dados ou em caso de erro.
 */
export async function carregarDesempenhoPorCaracteristica(): Promise<CaracteristicaDesempenho[]> {
  try {
    const client = await createActionClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return [];

    const { data, error } = await client
      .from("diag_cross_subtema_dimensao")
      .select("dimensao_chave, dimensao_nome, valor_nome, n_feitas, n_acertos")
      .eq("user_id", user.id);

    if (error || !data) return [];

    // Mapeia para CelulaCrossInput — coalesce de nulos (view pode retornar null)
    const celulas = (data as CrossRow[]).map((row) => ({
      dimensaoChave: row.dimensao_chave ?? "",
      dimensaoNome:  row.dimensao_nome  ?? "",
      valorNome:     row.valor_nome     ?? "",
      nFeitas:       Number(row.n_feitas  ?? 0),
      nAcertos:      Number(row.n_acertos ?? 0),
    }));

    // Filtra linhas sem dimensão (dados sujos / nulos propagados)
    const celulasValidas = celulas.filter((c) => c.dimensaoChave !== "");

    // Agregação e classificação na lib PURA — anti-chute garante "medindo" abaixo do gate
    return agregarCaracteristicas(celulasValidas);
  } catch {
    return [];
  }
}
