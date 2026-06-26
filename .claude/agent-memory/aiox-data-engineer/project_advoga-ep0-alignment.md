---
name: advoga-ep0-alignment
description: EP-0 arch alignment migrations — which D-1..D-9 were already done vs added; slug pattern for seed idempotency
metadata:
  type: project
---

EP-0 fechamento: migrations 120003 (alinhamento) e 120004 (seed taxonomia) entregues em 2026-06-21.

**Why:** Aria (@architect) listou 9 pedidos D-1..D-9 que o schema EP-0 precisava satisfazer antes do Drop 1.

**Status final por pedido:**

| Item | Status | Onde |
|------|--------|------|
| D-1 questoes_prova view | ADICIONADO | 120003 |
| D-2 3 views diagnóstico | JA FEITO | 120001 |
| D-3 índices agregações | JA FEITO | 120000 §7 |
| D-4 integridade EAV | PARCIAL→COMPLETADO | 120003 (questao_tags_categorica_uniq) |
| D-5 corrigir_sessao() | ADICIONADO | 120003 |
| D-6 security_invoker nas views | ADICIONADO | 120003 (ALTER VIEW SET) |
| D-7 gate calibrável | JA FEITO | 120001 (diag_gate_minimo()) |
| D-8 anuladas fora denominador | ADICIONADO | 120003 (CREATE OR REPLACE VIEW) |
| D-9 tipos TypeScript | PROCESSO | executar após db push |

**Decisões críticas:**
- D-4: UNIQUE (questao_id, dimensao_id, valor_id) sem `origem` → `questao_tags_categorica_uniq`. A constraint existente `questao_tags_uniq` com `origem` foi mantida (rastreabilidade §8.5). As duas coexistem.
- D-5: `corrigir_sessao` SECURITY DEFINER (gabarito só server-side). Anuladas → correta=TRUE. Puladas (resposta_dada NULL) → correta=FALSE.
- D-8: `v_respostas_corrigidas` recriada com `AND q.validade_status <> 'anulada'`. Todas as views de diagnóstico recridas via CREATE OR REPLACE para herdar.
- SLUG: coluna slug UNIQUE adicionada em materias, subtemas, micro_topicos (necessário para seed idempotente 120004).

**Seed 120004:**
- materias: 20, subtemas: 192, micro_topicos: 63 (7 subtemas semente), dimensoes: 12, dimensao_valores: 6
- Chave de idempotência: ON CONFLICT (slug) para hierarquia; ON CONFLICT (chave) para dimensoes; ON CONFLICT (dimensao_id, valor) para dimensao_valores

**How to apply:** `supabase db push` aplica em ordem lexicográfica. Após: `supabase gen types typescript --local > src/lib/types/db.types.ts`
