"use server";

// Server Action de leitura — Esforço × Resultado (Drop 2)
// Lê v_esforco_resultado e classifica cada nó no quadrante correto.
// Anti-chute §4: a classificação ocorre na lib PURA (esforco.ts) — nunca aqui.

import { createActionClient } from "@/lib/supabase/action";
import {
  classificarEsforcos,
  type EsforcoNo,
} from "@/lib/diagnostico/esforco";
import type { Database } from "@/lib/types/db.types";

type EsforcoResultadoRow =
  Database["public"]["Views"]["v_esforco_resultado"]["Row"];

/**
 * Carrega os nós de Esforço × Resultado para o usuário autenticado.
 *
 * @param eixo - Granularidade: "materia" (default) | "subtema"
 * @returns Array de EsforcoNo com quadrante classificado, ordenado por total_min desc.
 *          Retorna [] se não autenticado ou sem dados.
 */
export async function carregarEsforcoResultado(
  eixo: string = "materia"
): Promise<EsforcoNo[]> {
  try {
    const client = await createActionClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return [];

    const { data, error } = await client
      .from("v_esforco_resultado")
      .select(
        "user_id, eixo, no_id, no_nome, total_min, n_sessoes, n_feitas, n_acertos, taxa, padrao_confiavel"
      )
      .eq("user_id", user.id)
      .eq("eixo", eixo)
      .order("total_min", { ascending: false });

    if (error || !data) return [];

    // Mapeia para EsforcoNoInput — coalesce de nulos (FULL OUTER JOIN na view)
    const inputs = (data as EsforcoResultadoRow[]).map((row) => ({
      noId:             row.no_id    ?? "",
      noNome:           row.no_nome  ?? "",
      eixo:             row.eixo     ?? eixo,
      totalMin:         Number(row.total_min  ?? 0),
      nFeitas:          Number(row.n_feitas   ?? 0),
      nAcertos:         Number(row.n_acertos  ?? 0),
      taxa:             Number(row.taxa       ?? 0),
      padraoConfiavel:  row.padrao_confiavel  ?? false,
    }));

    // Classificação na lib PURA — anti-chute garante "medindo" quando não confiável
    return classificarEsforcos(inputs);
  } catch {
    return [];
  }
}
