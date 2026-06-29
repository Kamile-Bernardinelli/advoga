// Fronteira de segurança: colunas públicas da prova (view questoes_prova) — NUNCA incluir gabarito.
export const COLUNAS_QUESTAO_PROVA = [
  "id", "enunciado", "alt_a", "alt_b", "alt_c", "alt_d",
  "num_prova", "validade_status", "materia_id", "subtema_id",
] as const;

// Colunas que JAMAIS podem chegar ao client antes do finalize.
// "comentario" entra aqui porque a explicação REVELA a resposta correta —
// mesmo regime do gabarito (tabela public.comentarios, lida só pós-resposta em /resultado).
export const COLUNAS_RESPOSTA_PROIBIDAS = [
  "gabarito", "correta", "resposta_correta", "alternativa_correta", "comentario",
] as const;
