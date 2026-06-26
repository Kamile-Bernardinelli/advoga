# QA Gate Report — Drop 1 (EP-1 Combat Core)

> **Agente:** Quinn (@qa) · **Modelo:** claude-sonnet-4-6 · **Data:** 2026-06-21
> **Scope:** Stories 1.1–1.6 · DB local `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
> **Referência DoD:** HANDOFF-AIOX.md §8 — "A Kamile consegue: abrir uma prova → responder sem gabarito → finalizar → ver acerto/erro por matéria/subtema em gráfico → ver quantos dias faltam → receber plano de questões de hoje."

---

## Veredito

**CONCERNS**

O loop de correção funciona, segurança do gabarito está intacta, e a arquitetura de diagnóstico está implementada. O gate é bloqueado por 2 erros de lint (ESLint) e por scope de dados insuficiente (apenas 1 edição no banco vs. mínimo especificado de ≥10 para Drop 1). Esses itens são CONCERNS sérios, não FAIL crítico, pois o fluxo ponta-a-ponta funciona com o dado disponível — mas o DoD Drop 1 literal não está satisfeito.

---

## Itens do Gate

### 1. Correção vs. gabarito — `node scripts/smoke-flow.mjs`

| Resultado | Status |
|---|---|
| 7 certas / 3 erradas / 0 sem_correcao / 10 total | PASS |

`corrigir_sessao()` corrigiu corretamente 7 respostas idênticas ao gabarito e 3 divergentes. Resultado limpo, sessão removida após o teste. A função é transacional e idempotente (`FOR UPDATE` na sessão + `COALESCE(fim, now())`).

---

### 2. Gate anti-chute ≥8

| Verificação | Resultado | Status |
|---|---|---|
| `diag_gate_minimo()` retorna | 8 | PASS |
| `diag_por_no.amostra_suficiente` = `n_feitas >= gate_minimo` | Confirmado no DDL | PASS |
| `weakness-score.ts` retorna `null` se `nFeitas < gateVolume` | Confirmado em código | PASS |
| Planner separa nós `volume_ok=false` como "medir" (AC-1.6.3) | Confirmado em `planner.ts` linhas 47-48 | PASS |
| Gate alinhado nas views SQL e no TypeScript (defense in depth) | `diag_gate_minimo()` = 8; `config.ts gateVolume` = 8 | PASS |

O gate está implementado em duas camadas (SQL view + app layer), conforme §4 do brief. Nós com `amostra_suficiente=false` calculam `weakness_score` mas são tratados como "medir" no planner — não vão para o ranking de fraquezas. Correto.

---

### 3. Segurança — gabarito não vaza antes do `finalize`

| Verificação | Resultado | Status |
|---|---|---|
| View `questoes_prova` existe | Sim | PASS |
| Coluna `gabarito` presente na view | **NÃO** — ausente | PASS |
| `validade_motivo` presente na view | Ausente | PASS |
| Colunas expostas | `id, exame_id, num_prova, enunciado, alt_a..d, materia_id, subtema_id, micro_topico_id, dificuldade, validade_status, fonte_url, created_at, updated_at` | PASS |
| `page.tsx` da prova usa `.from("questoes_prova")` | Confirmado em `(teste)/teste/[sessaoId]/page.tsx:45` | PASS |
| `src/lib/supabase/server.ts` documenta restrição | "NUNCA seleciona questoes.gabarito em fluxo de prova ativa" | PASS |

**Gabarito não vaza.** A view exclui `gabarito` e `validade_motivo` por projeção. O RSC da prova lê exclusivamente `questoes_prova`. Ausência de teste E2E `gabarito-nao-vaza.spec.ts` é registrada como CONCERN (arquivo previsto na arquitetura, não implementado).

---

### 4. Diagnóstico por matéria + subtema funciona (query das views)

| Verificação | Resultado | Status |
|---|---|---|
| View `diag_por_no` existe e retorna dados | 10+ linhas para o user de teste | PASS |
| View `diag_weakness_score` existe e retorna | Rows com `weakness_score` e `amostra_suficiente` | PASS |
| Eixo `materia` — 5 matérias com dados | Confirmado com dados reais da sessão de smoke | PASS |
| Eixo `subtema` — 10+ subtemas com dados | Confirmado | PASS |
| Gate aplicado: `amostra_suficiente=false` onde `n_feitas < 8` | Todos os subtemas com n_feitas 1-6 marcados `false` | PASS |
| Views `v_diagnostico_conteudo`, `v_diagnostico_dimensao`, `v_diagnostico_cross` (arquitetura §4) | **AUSENTES** — apenas `diag_por_no`, `diag_weakness_score`, `diag_cross_subtema_dimensao`, `v_respostas_corrigidas` existem | CONCERN |

**Observação sobre nomenclatura:** A arquitetura define `v_diagnostico_conteudo/dimensao/cross` mas a implementação usa `diag_por_no/diag_weakness_score/diag_cross_subtema_dimensao`. Funcionalmente equivalente; os nomes diferem do spec da arquitetura. Não é um FAIL (o comportamento está correto), mas gera drift documental.

---

### 5. Countdown + Planner gerando dado real

| Item | Verificação | Status |
|---|---|---|
| Countdown em `page.tsx` (home) | `EXAM_DATE = new Date("2026-09-06T00:00:00-03:00")` — server-side | PASS |
| Countdown em `(verificacao)/dashboard` | `PROVA_DATE = "2026-09-06"` + `CountdownWidget` | PASS |
| Cálculo em dias inteiros | `getDaysUntil` + `getDaysUntilExam` presentes | PASS |
| Planner busca `diag_weakness_score` (dados reais) | `fetchNosMateria` via view, `fetchMateriaErradasRecentesBoosts` via respostas | PASS |
| `plano_diario` persiste (AC-1.6.7) | UPSERT em `planner.actions.ts` | PASS |
| Ética garantida (AC-1.6.4) | `pisoEticaDiario` + separação no `gerarPlano` | PASS |
| Boosts de repetição espaçada (AC-1.6.5) | `SubtemaBoost` com `multiplicador` nos últimas 2 sessões | PASS |

---

### 6. Redirects — `/verificacao/resultado` removido

| Verificação | Resultado | Status |
|---|---|---|
| `grep -rn "/verificacao/" src/` | 0 resultados | PASS |
| `sessao.actions.ts:143` redireciona para | `/resultado/${sessaoId}` | PASS |
| Route `(verificacao)/resultado/[sessaoId]/page.tsx` resolve para | `/resultado/[sessaoId]` (route group transparente) | PASS |
| `dashboard/page.tsx:178` link para resultado | `/resultado/${ultimaSessaoInfo.sessaoId}` | PASS |

Nenhuma referência a `/verificacao/resultado` no código-fonte. Redirect correto.

---

### 7. Build e TSC

| Verificação | Resultado | Status |
|---|---|---|
| `npx tsc --noEmit` | **0 erros, 0 warnings** | PASS |
| Build `.next/` existe (`BUILD_ID` presente) | `vSsPVRmG_kILiHazDC8rR` | PASS |
| ESLint — erros | **2 ERROS** (ver abaixo) | FAIL |
| ESLint — warnings | 1 warning | CONCERN |

**Erros de ESLint (bloqueadores de lint):**

| # | Arquivo | Linha | Regra | Descrição |
|---|---|---|---|---|
| E-01 | `src/app/(verificacao)/resultado/[sessaoId]/page.tsx` | 323 | `@next/next/no-html-link-for-pages` | `<a href="/teste">` — deve ser `<Link>` do `next/link` |
| E-02 | `src/app/(teste)/teste/[sessaoId]/prova-runner.tsx` | 50 | `react-hooks/set-state-in-effect` | `setSegundos(decorrido)` chamado diretamente no corpo do `useEffect` (causa re-render em cascata) |

**Warning:**

| # | Arquivo | Linha | Regra | Descrição |
|---|---|---|---|---|
| W-01 | `src/app/(teste)/teste/[sessaoId]/prova-runner.tsx` | 163 | `@typescript-eslint/no-unused-vars` | Variável `i` definida mas não usada |

---

## Problemas Conhecidos (documentados, não bloqueadores do gate nesta fase)

| # | Problema | Severidade | Categoria |
|---|---|---|---|
| K-01 | **Apenas 1 edição carregada (42º OAB).** DoD Drop 1 especifica ≥10 edições. Story 1.1 AC-1.1.1 não cumprida. Pipeline de ingestão das demais edições não executado. | HIGH | Dados / Story 1.1 |
| K-02 | **~3-4 matérias taggueadas incorretamente** (LLM ~95% de precisão no tagging). Sem auditoria formal de quais questões estão com tag errada. AC-1.1.5 exige ≥95% coverage — coverage de 100% existe mas qualidade das tags não foi validada adversarialmente. | MEDIUM | Qualidade de dados |
| K-03 | **Ambiente Consulta é placeholder** (`legislacao/page.tsx` retorna stub "Drop 1: links externos ao Planalto. Drop 3: busca full-text integrada."). Previsto como stub no DoD Drop 1, porém a tela de questões pesquisável (`consulta/questoes/`) também não foi verificada nesta revisão. | LOW | Funcionalidade (Drop 3) |
| K-04 | **Teste E2E `gabarito-nao-vaza.spec.ts` e `fluxo-prova.spec.ts` não implementados.** Arquitetura prevê esses testes como gate de CI. A proteção de gabarito está válida na view, mas o teste automatizado que "falharia o build" se vazasse não existe. | HIGH | Testes de segurança |
| K-05 | **Views `v_diagnostico_conteudo`, `v_diagnostico_dimensao`, `v_diagnostico_cross`** (nomes canônicos da arquitetura §4) não foram criadas. Foram substituídas por `diag_por_no`, `diag_weakness_score`, `diag_cross_subtema_dimensao`. Funcionalmente equivalentes. Drift entre arquitetura doc e implementação. | LOW | Documentação |
| K-06 | **`tsconfig.tsbuildinfo` usa TypeScript 5.9.3** (package.json usa `5.6+`). Nenhum erro de tipo — apenas observação de versão. | INFO | Ferramental |

---

## Resumo Executivo

| Gate Item | Resultado |
|---|---|
| 1. Correção vs. gabarito (7/3) | PASS |
| 2. Gate anti-chute ≥8 | PASS |
| 3. Segurança — gabarito não vaza | PASS |
| 4. Diagnóstico matéria+subtema | PASS (com nomenclatura divergente) |
| 5. Countdown + Planner com dado real | PASS |
| 6. Redirects `/resultado` corretos | PASS |
| 7. Build/TSC verdes | FAIL — 2 erros ESLint |

**Decisão final: CONCERNS**

- A arquitetura de segurança do gabarito está sólida.
- O loop de correção funciona corretamente contra gabarito real.
- O gate anti-chute ≥8 está implementado com defense in depth (SQL + TypeScript).
- O planner gera dados reais a partir das views de diagnóstico.
- O countdown está presente e correto em dois contextos.
- Não há referência a `/verificacao/resultado` — redirect correto.

**Itens que precisam de correção antes de aprovação plena:**

1. **[P1 — obrigatório antes de merge]** Corrigir 2 erros ESLint: substituir `<a>` por `<Link>` em `resultado/page.tsx:323`; refatorar `setSegundos` para fora do corpo direto do `useEffect` em `prova-runner.tsx:50`.
2. **[P1 — DoD Drop 1 literal]** Carregar as demais edições OAB (mínimo 10) para satisfazer AC-1.1.1 — Story 1.1 pipeline de ingestão pendente de execução completa.
3. **[P2 — recomendado antes de deploy]** Implementar `gabarito-nao-vaza.spec.ts` e `fluxo-prova.spec.ts` (E2E de segurança e fluxo ponta-a-ponta). Atualmente a proteção de gabarito é verificável manualmente mas não tem cobertura automatizada.

---

## Change Log

| Data | Evento |
|---|---|
| 2026-06-21 | Gate QA Drop 1 executado por Quinn (@qa). Veredito: CONCERNS. 2 erros ESLint + 1 edição no banco (vs. ≥10 do DoD). |
