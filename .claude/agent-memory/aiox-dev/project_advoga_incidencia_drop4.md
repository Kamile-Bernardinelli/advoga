---
name: project-advoga-incidencia-drop4
description: Drop 4 advoga — painel /incidencia (descritivo, anti-chute) + convenção de testes vitest do repo
metadata:
  type: project
---

Drop 4 entregue 2026-06-29 (branch `feat/drop4-incidencia-tendencia`, commit a2f1bd4, NÃO pushado — @devops faz o push). Página `/incidencia` no ambiente `(verificacao)`: incidência & tendência por subtema, lendo `v_incidencia_subtema` + `v_tendencia_subtema` (fato do corpus, sem user_id). Spec: `docs/architecture/trend-display-spec.md`.

**Decisões não-óbvias (úteis p/ futuro):**
- **DESCRITIVO, não preditivo (anti-chute §7).** O findings do Dara provou que a "rotação" de subtemas é igual/menor que o acaso. Logo: sparklines monocromáticas (slate-300, nunca por direção), sem setas/rótulos "em alta/queda", banner não-dismissível acima dos dados, card de estabilidade neutro (cinza →). NUNCA adicionar previsão/peso de rotação no planner. Mesma regra do `progresso/page.tsx` (veredito só com volume confiável).
- **Densificação dos zeros.** `v_tendencia_subtema` só emite células não-zero (INNER JOIN); par ausente = 0 real. `lib/incidencia/tendencia.ts` (pura) preenche os zeros no eixo GLOBAL de edições e normaliza pela escala global (maxSerie) → a sparkline mostra a planura, não o ruído. Teste cobre o caso do "0 no meio".
- **db.types.ts** regenerado via Management API — ver [[supabase-gentypes-junk]].

**Convenção de testes do repo (IMPORTANTE, não era óbvio):**
- Testes ficam em `tests/unit/*.test.ts` (NÃO co-locados em src/). Há `vitest.config.ts` na raiz com alias `@` → `./src` e include default. Imports nos testes usam `@/lib/...`.
- `npx vitest run` (full) roda TUDO, incl. testes de framework em `.aiox-core/**/__tests__/` que **falham por pré-existência** (jest-not-defined em wave-analyzer/suggestion-engine; `@aiox/testing` ausente em example-agent). Esses 3 são ruído conhecido — ignorar.
- Para rodar SÓ os testes do projeto, verdes: `vitest run --dir tests` (é o script `npm test` que adicionei). NÃO usar `vitest run tests` — o "tests" casa como substring com `__tests__/` do aiox-core.
- `npm run lint` (sem args) também varre `.aiox-core` e tem ~1860 erros pré-existentes de framework. Lintar só os arquivos tocados (`npx eslint <paths>`) p/ validar o próprio trabalho.

**Why:** Kamile (OAB 1ª fase 06/09/2026) precisa priorizar volume histórico sem cair na ilusão de "adivinhar a próxima prova".

**How to apply:** Não tocar: db.types.ts (à mão), diagnostico/*, lib/planner/* (sem peso de tendência), gabarito/enunciado. Padrões a reusar: fetch RSC do `dashboard/page.tsx`, chart do `grafico-materias.tsx` (mas cor única), tabela do `progresso/page.tsx`, nav do `(estudo)/layout.tsx`, deep-link `/treino?subtema=` do `cronograma-view.tsx`. Relacionado: [[project-cockpit-v2-drop1-5]].
