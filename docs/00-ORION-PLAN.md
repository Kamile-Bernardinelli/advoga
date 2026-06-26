# Advoga · Plano de Orquestração (Orion) — APROVADO

> **Orquestrador:** Orion (@aiox-master) · **Owner:** Marcos · **Usuária:** Kamile
> **Aprovado:** 2026-06-21 · **Modo:** local-first, autônomo até o Drop 1 live.
> **Restrição-mãe:** prova 06/09/2026 (77 dias em 21/06). Drop 1 usável em DIAS.
> **Fontes da verdade:** `the-brain/mega-brain-premium/workspace/personal/kamile-oab/` → `01-BRIEF.md` (PRD), `00-BRAINDUMP-RAW.md` (verbatim), `02-RESEARCH-*.md`, `HANDOFF-AIOX.md`.

## Estratégia de credenciais
- **Build 100% local:** Supabase local (Docker) + Next.js dev + PDFs públicos + ultracode na Claude Max. **Zero cloud key.**
- **Cloud só no deploy:** Supabase da Kamile + Vercel (+ GitHub opcional). Cockpit: `docs/setup/deploy-credentials.html`.
- Migrations idênticas local→cloud: promover = trocar `.env` + `db push`. Sem retrabalho.

## Alocação de modelo (política de custo)
- **OPUS:** Orion (orquestração), @architect, @data-engineer (design de schema), legal-chief (taxonomia).
- **SONNET:** @analyst, @pm, @dev (implementação), @data-engineer (migrations/exec), classificadores do ultracode.
- Toda troca é anunciada.

## Épicos
- **EP-0 Fundação** — PRD, arquitetura 4 ambientes, schema §8.2 (dimensões ABERTAS), RLS single-user, migrations escritas.
- **EP-1 Núcleo de Combate** — 10 edições recentes (~800q tag matéria+subtema), Teste sem-gabarito+timer, correção, diagnóstico matéria/subtema, dashboard+countdown, planner v1.
- **EP-2 Profundidade** — dimensões transversais + micro-tópico + cross-axis + Motor de Descoberta (§8.5).
- **EP-3 Histórico+Validade** — backfill →2010 + Motor de Validade vs Planalto (corte 25/05/2026).

## Status (atualizado pelo Orion)
### Fase 0 — Fundação  ✅ CONCLUÍDA
- [x] @analyst — brief AIOX-nativo + verificação edital 47 (R-04 confirmada, 80q) — `docs/00-project-brief.md`, `docs/research/edital-47-verification.md`
- [x] @pm — PRD + 4 épicos + 6 stories Drop 1 — `docs/prd/`, `docs/stories/`
- [x] @architect — arquitetura full-stack 4 ambientes (Next 16 + ssr + Recharts; 9 pedidos D-1..D-9) — `docs/architecture/fullstack-architecture.md`
- [x] @data-engineer — schema §8.2 + RLS single-user + views EAV + reconciliação D-1..D-9 + **seed** — `supabase/migrations/0000..0004`, `docs/architecture/SCHEMA.md`
- [x] legal-chief — taxonomia OAB (20 mat / 192 sub / 63 micro / 12 dim) — `docs/taxonomy/oab-1fase-taxonomy.md`

### Drop 1 — Núcleo de Combate  ✅ DoD COMPLETO (verificado e2e 2026-06-21, local)
- [x] Infra: Docker + Supabase local (stack enxuto) + Next.js 16 — `pnpm build` prod ✅ 11 rotas
- [x] 5 migrations + seed aplicados (20 mat / 192 sub / 63 micro / 12 dim / 6 valores)
- [x] Ingestão OCR (pdftoppm+tesseract, contornou encoding quebrado da FGV): 42º EOU, 80 questões legíveis
- [x] Ultracode: 80/80 tagueadas (matéria+subtema) + verificação adversarial (8 correções) → 144 questao_tags
- [x] App: login single-user · Teste sem-gabarito+timer · correção (`corrigir_sessao`) · diagnóstico matéria/subtema (gate ≥8) · dashboard+countdown · planner v1
- [x] Verificação: smoke (7/3) + e2e browser (prova→finalize→resultado→dashboard→planner) + build verde
- [ ] FILL/DEPLOY (próximo): ingerir 9 edições restantes (URLs por edição) · @qa formal · @devops deploy (keys via cockpit)

> DoD batido: Kamile abre prova real sem gabarito → finaliza → vê acertos/erros por matéria+subtema → vê dias restantes → recebe plano do dia. Tudo com dado real, anti-chute aplicado.

### Ingestão ampliada (2026-06-22)
- [x] 8 edições FGV carregadas (38,39,41,42,43,44,45,46) = **640 questões**
- [x] **640/640 tagueadas** (matéria+subtema+dimensões via ultracode com verificação adversarial; 1204 questao_tags). Distribuição valida (Ética 65, Civil 55, Const 50… ~pesos FGV×8).
- [ ] Pendentes de ingestão: ed.37 (gabarito = doc combinado 267p, sem grid Tipo-1) e ed.40 (Q44 falhou OCR) — revisita rápida
- [ ] QA gate: ESLint P1 corrigido; falta E2E `gabarito-nao-vaza` (P2)

### Drop 1.5 — Cockpit de Estudo (NOVO, prioridade 2026-06-26) 🔄
> Pilar novo: conteúdo + TEMPO de estudo (complementa o pilar de questões). Razão do timing: a *captura* do tempo-por-tema não pode esperar (dado perdido se não registrar); a *análise* esforço×resultado é Drop 2.
- Design: `docs/architecture/study-cockpit.md` (aditivo) · edital ingerido: `docs/research/edital-47-ingested.md` + `data/sources/edital-47-marcos.json`
- [ ] Schema: `estudo_sessoes` (sensor tempo) + `cronograma_blocos` (roteiro) + `materiais` + views `v_tempo_por_no`/`v_esforco_resultado` (gate duplo)
- [ ] `lib/planner/cronograma.ts` (reusa planner) — roteiro conteúdo+questões por incidência×fraqueza, dose Ética, repetição espaçada
- [ ] UI (estudo): registro de tempo (manual → Fatia 1) + cronograma marcável + (Fatia 2) timer/materiais/stat
- **Fatia 1 = Kamile estuda+registra HOJE.** Correlação esforço×resultado = telas no Drop 2 (view já captura desde já).
- ⚠️ Drift pré-existente a corrigir: `lib/diagnostico/queries.ts` → views `v_diagnostico_*` inexistentes (reais: `diag_por_no`).
- [x] Cronograma sequenciamento CORRIGIDO (lidera Ética/Civil conteúdo; conteúdo antes de questões; ~272 blocos/60min) + registro `revalidatePath` ✅ (verificado no browser: registro grava, telas renderizam)
- [x] Loop de aderência DESENHADO (`study-cockpit-v2-metas.md`): metas base/override/mensal + timer + saldo/compensação + plano-do-dia unificado
- [x] **Fatia A CONCLUÍDA + verificada no browser:** metas (base+override+mensal) · timer start/stop (1 por vez) · saldo/compensação · `/plano` cockpit unificado (meta+saldo+blocos+timer). 50/50 testes, build verde.
- [x] **Fatia B CONCLUÍDA + verificada:** `/metas` (base+mensal+dias+fuso+override) · compensação 1-clique · `/materiais` CRUD + material_id · `/progresso` (tempo/matéria) · gráficos Recharts · re-plan. 316/317 testes, build verde.
- [ ] **DEPLOY (escolhido como próximo):** @devops prepara migrate-to-cloud (keys-independent); owner preenche cockpit (Supabase Kamile + Vercel) → publica.
- [ ] **DEPLOY** = gargalo real p/ Kamile usar (Supabase dela + Vercel via cockpit). Sem deploy, o sensor não captura nada (ela não acessa localhost).
- ⚠️ Acesso: roda em localhost; p/ Kamile usar = DEPLOY (Supabase dela + Vercel via `docs/setup/deploy-credentials.html`).

### Retomada 2026-06-26 (Orion — verificação de ambiente, nova sessão)
- ✅ Ambiente de pé: Docker UP · Supabase local UP · **dados 100% intactos** (640 questões / 1204 tags / taxonomia 20·192·63·12·6 / Kamile / 272 blocos cronograma / 1 meta_estudo + 5 metas_diarias). `db reset` NÃO aconteceu.
- ✅ Dev server advoga na **porta 3001** (3000 = DR OPS, outro projeto — não tocar). 10 rotas saudáveis: `/login` 200, protegidas 307→/login (auth-guard OK, **zero 500**).
- 📊 Uso real registrado: **86 respostas (50 acertos / 36 erros)** em 3 sessões → fuel p/ Motor de Descoberta (§8.5) já existe (modesto mas real).
- ⚠️ Browser (render logado de `/plano`,`/metas`) PENDENTE: extensão Chrome travada (provável prompt de permissão no side-panel — só Marcos dismissa) → retomar quando liberar.
- ⚠️ Disco data-volume **99%** (7,4 GB livres) → deploy OK (escreve no cloud); OCR/backfill Drop 3 SÓ no drive externo (`/Volumes/Seagate 1` atualmente NÃO montado; backup `advoga-db-backup.sql` lá → inacessível agora).
- ✅ Deploy pronto p/ disparar: `scripts/deploy/migrate-to-cloud.mjs` + `data/tags/all-tags.json` presentes.
- 🔹 Loose end menor: `exames.edicao/numero_romano/ano` aparecem nulos na tabela (identidade da edição vem do all-tags.json).
- ✅ Owner decidiu (2026-06-26): git init AGORA + **Pontas de correção** (sem keys de deploy ainda).

### Git safety net (2026-06-26)
- ✅ Repo git inicializado (não havia VCS). Baseline `ffb3282` (master) + branch `fix/pontas-fuso-queries-guard`. Secrets fora do stage; `docs/setup/deploy-credentials.html` agora gitignored. SEM push (push = @devops).

### Pontas de correção — CONCLUÍDAS + verificadas (2026-06-26, commit `1660f16`)
Investigação (Opus) refinou o escopo do handoff. @dev (Sonnet) implementou; Orion verificou.
- **Ponta 2 (BUG REAL — fuso UTC):** `planner.actions.ts` (carregarPlanoDoDia, gerarPlanoDiario) + `cronograma.actions.ts` (_carregarBlocos, gerarCronograma) usavam `new Date().toISOString()` em UTC → na Vercel (UTC) com Kamile UTC−3, plano/cronograma do **dia errado após 21h**. FIX: helper compartilhado `lib/metas/tz-server.ts` (`carregarTimezone`+`hojeDoUsuario`) sobre o `hojeLocal(tz)` existente; os 4 sites trocados. Kamile.timezone=America/Sao_Paulo (confirmado).
- **Ponta 1 (código morto):** `lib/diagnostico/queries.ts` apontava p/ views inexistentes `v_diagnostico_*` mas NÃO era importado por ninguém (não há rota /diagnostico; telas vivas já leem views reais). Repontado p/ `diag_weakness_score` + `diag_cross_subtema_dimensao` (sem deletar — há git agora, mas owner escolheu repoint).
- **Ponta 3 (guard, NÃO era bug):** gabarito NÃO vaza (view `questoes_prova` exclui `gabarito`; `saveResposta` força `correta=null`; finalize via service_role). Trava anti-regressão: `lib/teste/colunas-prova.ts` + select via constante + `tests/unit/gabarito-nao-vaza.test.ts`.
- **Ponta 4 (re-plan no override):** JÁ estava feita (override revalida /plano + /cronograma).
- Verificação: `tsc --noEmit` limpo; **51/51 testes do projeto** verdes (inclui o novo guard); diff revisado; saldo.actions.ts e db.types.ts intocados.
- ⚠️ PENDENTE: render *logado* (/plano,/metas,/cronograma) no browser — extensão Chrome travada em prompt de permissão (Marcos libera no side-panel). Fix é code-only/baixo risco; verificado por tsc + testes + diff + dependência DB (timezone).
- 🔵 Drop-2 cleanup opcional: unificar os 5 call-sites de tz num só helper (saldo.actions.ts ainda inline, mas já correto).
- ⏭️ Próximo: smoke no browser (quando Chrome liberar) → merge `fix/pontas-...` em master → DEPLOY (keys) ou Drop 2.

## DoD Drop 1
Kamile abre prova recente real → responde sem gabarito → finaliza → vê acertos/erros por matéria+subtema em gráfico → vê dias restantes → recebe o plano de questões do dia. Ponta-a-ponta com dados reais (local).

## Regras inegociáveis
Anti-chute (§4, gate volume ≥8); segredo só em `.env`; só @devops dá push; handoff documentado ao fim de cada fase.
