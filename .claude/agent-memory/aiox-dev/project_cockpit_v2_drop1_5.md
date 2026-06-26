---
name: project-cockpit-v2-drop1-5
description: Cockpit v2 Fatia A+B concluídas — loop de aderência + compensação + materiais + progresso + gráficos
metadata:
  type: project
---

Fatia A + Fatia B do Cockpit v2 entregues em 2026-06-26.

**Estado após Fatia B (2026-06-26):**

Fatia A (já existia):
- `metas_estudo` + `metas_diarias` + views + `meta_do_dia()` — migration aplicada
- `saldo.ts` puro: calcularDiasRestantesMes, calcularPropostaCompensacao, montarAderenciaHoje
- Timer: `timer-estudo.tsx` + `timer-store.ts` (Zustand v5)
- Actions: `metas.actions.ts`, `saldo.actions.ts`, `cronograma.actions.ts`
- Plano cockpit: `/plano` (RSC + PlanoDodia client)

Fatia B (entregue nesta sessão):
- `src/lib/types/domain.ts` — Material + TempoPorNo adicionados
- `src/app/(estudo)/_actions/materiais.actions.ts` — CRUD: listar/criar/atualizar/remover materiais
- `src/app/(estudo)/_actions/compensacao.actions.ts` — previewCompensacao + aplicarCompensacao (UPSERT overrides + regenerarCronograma)
- `src/app/(estudo)/_actions/cronograma.actions.ts` — `regenerarCronograma()` adicionado (lê meta do DB, não precisa de horasPorDia)
- `src/app/(estudo)/_actions/metas.actions.ts` — carregarOverridesMes() adicionado; revalidatePath(/metas) nos actions existentes
- `src/app/(estudo)/metas/page.tsx` + `metas-form.tsx` — /metas completa: config base/mensal/dias/tz, overrides calendário, gráficos Recharts, compensação 1-clique
- `src/app/(estudo)/materiais/page.tsx` + `materiais-form.tsx` — /materiais CRUD completo
- `src/app/(estudo)/progresso/page.tsx` + `grafico-tempo-por-materia.tsx` — /progresso com tabela + barras horizontais
- `src/components/estudo/grafico-saldo-dias.tsx` — BarChart real×meta últimos 14 dias
- `src/components/estudo/grafico-progresso-mensal.tsx` — RadialBarChart anel de progresso mensal
- `src/app/(estudo)/registro/registro-form.tsx` — material_id select adicionado
- `src/app/(estudo)/registro/page.tsx` — listarMateriais() em paralelo
- `src/components/estudo/timer-estudo.tsx` — materialId prop + "meta atingida" suggestion + fix lint (setElapsed via interval callback)
- `src/app/(estudo)/layout.tsx` — /metas, /materiais, /progresso no nav

**Números do smoke (2026-06-26, Kamile ea7c5c9d):**
- Material criado: "Codigo Civil 2024" (livro) → id=433c6603-...
- Sessão com material_id: 60min Direito Civil + Codigo Civil 2024 → confirmado no DB
- v_tempo_por_no: Direito Civil 105min (2 sessões) ✓
- Override 2026-06-27 = 300min → meta_do_dia retorna 300 (vence base 240) ✓
- Compensação: 5 overrides de 270min (teto=270) gravados; meta_do_dia retorna 270 para cada ✓
- Mismatch diagnosticado: 177min pending em dia de meta 120 (2026-06-26) → regenerarCronograma() resolve
- Build: `/metas`, `/materiais`, `/progresso` listados como rotas dinâmicas ✓
- tsc limpo, vitest 316/317 (1 fail pre-existente em aiox-core), pnpm build verde

**Pendente (Drop 2):**
- Superfície de v_esforco_resultado (quadrantes esforço×resultado)
- Alinhar "hoje" do app ao fuso (drift UTC pré-existente em cronograma.actions.ts)
- Recharts: heatmap de aderência mensal

**Why:**
Kamile precisa fechar OAB 1ª fase em 06/09/2026. Fatia B fecha o loop: ela vê progresso por matéria, usa materiais no registro/timer, e tem compensação 1-clique quando atrasa.

**How to apply:**
- Não tocar: db.types.ts, diagnostico/*, (teste)/, (verificacao)/, fases/ordenação do cronograma
- `regenerarCronograma()` é a ação canônica para re-plan sem parâmetro
- `previewCompensacao()` + `aplicarCompensacao()` para o fluxo de compensação
- Recharts: isAnimationActive={false}, formatter sem tipagem explícita de number (ValueType | undefined)
