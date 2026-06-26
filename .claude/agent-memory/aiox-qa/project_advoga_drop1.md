---
name: advoga-drop1-qa-gate
description: QA gate result for Advoga Drop 1 (EP-1). Key findings: 2 ESLint errors, only 1 exam loaded (needs 10), E2E tests missing, security gate passed, correction loop correct.
metadata:
  type: project
---

QA Gate Drop 1 executado em 2026-06-21. Veredito: CONCERNS.

**Passou:** correção vs. gabarito (7/3 correto), gate anti-chute ≥8 no SQL e TypeScript, view `questoes_prova` sem coluna `gabarito`, countdown implementado, planner gera dado real do banco, redirect `/resultado` correto, TSC zero erros.

**Pendente — bloqueadores:**
1. 2 erros ESLint: `<a>` em `resultado/page.tsx:323` (usar `<Link>`), `setSegundos` direto no corpo do `useEffect` em `prova-runner.tsx:50`
2. Apenas 1 edição no banco (42º OAB, 80 questões). AC-1.1.1 exige ≥10. Pipeline de ingestão das demais edições não rodou.

**Pendente — recomendado:**
- Testes E2E `gabarito-nao-vaza.spec.ts` e `fluxo-prova.spec.ts` ausentes (previstos na arquitetura mas não implementados)

**Why:** Drop 1 DoD literal não satisfeito por dado insuficiente no banco e erros de lint.
**How to apply:** Em próxima sessão: rodar pipeline de ingestão das 9 edições restantes, corrigir 2 erros ESLint, criar testes E2E mínimos, então re-gate.

View names divergem da arquitetura: `diag_por_no`/`diag_weakness_score`/`diag_cross_subtema_dimensao` no lugar de `v_diagnostico_conteudo/dimensao/cross` — funcionalmente equivalentes mas geram drift documental.
