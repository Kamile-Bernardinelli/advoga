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

### Drop 2 — Profundidade 🔄 (iniciado 2026-06-26, branch `feat/drop2-esforco-resultado`)
- [x] **Fatia 1 — Esforço × Resultado (commit `69c5513`):** classificador PURO `lib/diagnostico/esforco.ts` (5 estados; anti-chute §4: "medindo" sem o gate duplo ≥60min ∧ ≥8q — nunca veredito sem volume) + `_actions/esforco.actions.ts` (lê `v_esforco_resultado`, coalesce FULL OUTER, classifica na lib pura) + seção quadrantes 2×2 em `/progresso` (esforço sem retorno / dominado / subexposto / eficiente) + bloco "Ainda medindo" + empty-state + 11 testes. Limiares calibráveis em `config.ts` (`taxaBoaEsforco=0.6` acima do corte OAB 50%; `tempoAltoEsforcoMin=120` = 2× o gate). Verificado: tsc limpo + **62/62 testes**; view real consultada (hoje Kamile = tudo "medindo", volume fino → UI honesta).
  - ⚠️ Render visual pendente (extensão Chrome travada); lógica + dados verificados sem browser.
  - 🔧 Calibração p/ o owner: `taxaBoaEsforco` (0.6) e `tempoAltoEsforcoMin` (120) — 1 arquivo, sem migration.
- [x] **Fatia 2 — Cross-axis / desempenho por característica (commit `db5d7ab`, merged `fa53ab3`):** agrega `diag_cross_subtema_dimensao` por (dimensão, valor) → veredito forte/fraco/medindo (anti-chute gate ≥8; reusa gateVolume + taxaBoaEsforco). `lib/diagnostico/cross.ts` (puro, 15 testes) + `cross.actions.ts` + seção em `/progresso` (por estilo + por traço). **TEM dado real:** caso-concreto 56% (fraco), letra-de-lei 65% (forte), enunciado-longo 49% (fraco). tsc + 80/80 testes. (Granular subtema×estilo = drill-down futuro, hoje vazio.)
  - 🧭 Achado acionável p/ Kamile: ela vai pior em **caso-concreto** e **enunciados longos** — sinal real do cross-axis.
- ✅ **Merge p/ master (2026-06-27):** pontas + anel + Drop 2 F1 (esforço) + F2 (cross-axis) + hardening fuso integrados em `master` (`fa53ab3`). Local, SEM push (push = @devops). Branches de feature preservadas.
- [ ] Fatia 3 — Motor de Descoberta de Variáveis (§8.5): minerar erros → propor dimensões. [ULTRACODE fan-out — esperar volume; hoje só 36 erros].

### Deploy-readiness + insight estratégico (2026-06-27)
- ✅ Script `scripts/deploy/migrate-to-cloud.mjs` AUDITADO ponta-a-ponta: deps existem (9 `oab*_tipo1.json` em `data/structured/` — ed40 pulada de propósito via allowlist; `load-exam.mjs` + `seed-user.mjs` presentes; `materias/subtemas.slug` + 6 valores `estilo_cognitivo` no banco). Idempotente, sem hardcode de secret. **Pronto p/ disparar quando vierem as keys.**
- ✅ Regressão do fuso travada: `tests/unit/hoje-local.test.ts` (fake timers; prova dia local vs UTC à noite). **65/65 testes**, tsc limpo.
- 🔑 **INSIGHT (anti-chute): o Drop 2 analítico está FAMINTO de dados.** Esforço (0 nós confiáveis) e cross-axis (0/134 células batem o gate ≥8) ficam 100% "medindo" até a Kamile USAR o app deployado e gerar volume. O gargalo real de valor é **DEPLOY** (keys da Kamile). Construir mais analytics agora = salas vazias. Sequência certa: keys → deploy → uso real → aí cross-axis/motor-de-erros viram significativos.
- ⏭️ Pré-deploy final (quando o dev server estiver livre): `pnpm build` (prod) — gate que o tsc não cobre 100%.

### 🚀 DEPLOY AO AR — EXECUTADO 2026-06-27 (Orion como @devops, autorizado pelo Marcos via `!`)
- ✅ **GitHub:** https://github.com/Kamile-Bernardinelli/advoga (privado, 1986 objetos). Anti-leak verificado: só `.env.example` versionado; nenhum segredo real no repo.
- ✅ **Supabase cloud** (ref `wxuvcttiohpakyvjbkvy`, us-west-2): 9 migrations · **640/640 questões tagueadas** · 1204 questao_tags · Kamile no auth (cloud id `72c98bcd-f047-498c-9bea-5e7b557fa005`) · metas_estudo (240/3000/todos-dias/America-Sao_Paulo) · `questoes_prova` SEM gabarito (boundary OK).
- ✅ **Vercel:** produção READY em **https://advoga-mu.vercel.app** (team kamile-bernardinelli-s-projects, 3 env vars de prod). /login 200, protegidas 307→login (auth-guard via curl).
- ✅ VERIFICADO NO AR (Playwright destravado, logado como Kamile): /plano (metas 240/3000 + fuso 2026-06-27), /cronograma, /teste (80q **SEM gabarito** — payload RSC sem chaves de resposta), /progresso (3 seções Drop 2). Prints `advoga-prod-*.png`. Sessão de teste limpa → cloud pristine (sessoes=0).
- 🐛 Bugs do deploy corrigidos no caminho: run-deploy.sh (repo existente→set origin+force-push; falso-positivo .env.example no anti-leak). `seed-user.mjs` tem bug (.env.local precede process.env → foi pro local) — NÃO corrigido no script; contornado criando user+metas direto no cloud (Admin API + psql). TODO: swap precedência se re-deployar.
- ⚠️ Hygiene: rotacionar VERCEL_TOKEN (o CLI ecoou no output); conectar repo↔Vercel no dashboard p/ auto-deploy (opcional).
- ✅ DISCO LIBERADO (autorizado pelo Marcos): `supabase stop` + remoção das 15 imagens Docker do Supabase (~12GB, re-baixáveis) → **2,4GB→14GB livres** (100%→97%). DB local era redundante (cloud + reproduzível dos data files); backup pg_dump falhou por version mismatch (PG17 vs pg_dump16) mas era desnecessário (só imagens re-baixáveis foram removidas, não dados). Recuperável via `supabase start` (re-baixa imagens + migrations + re-seed). App/cloud intocados + online (provado 3×).

## DoD Drop 1
Kamile abre prova recente real → responde sem gabarito → finaliza → vê acertos/erros por matéria+subtema em gráfico → vê dias restantes → recebe o plano de questões do dia. Ponta-a-ponta com dados reais (local).

## Regras inegociáveis
Anti-chute (§4, gate volume ≥8); segredo só em `.env`; só @devops dá push; handoff documentado ao fim de cada fase.

---

## DROP 2.5 — LIVE + VERIFICADO (2026-06-28) ✅
Feedback da Kamile (usuária real) atendido: cronograma **SUBTEMA-granular**, data-driven por incidência OAB, com loop de desempenho.
- Migrations no cloud (`v_incidencia_subtema` = COUNT q/subtema + `sessoes.subtema_id`). Deploy Vercel prod → **https://advoga-mu.vercel.app**.
- **VERIFICADO no ar** (Playwright, logado Kamile): cronograma com **415 blocos, TODOS com subtema**, ordem = incidência real (Penal›Teoria do crime 14q → Estatuto›Prerrogativas 14q → Const›Controle 11q → … → Proc.Civil›Cumprimento de sentença 10q); conteúdo antes de questões; Ética dosada; loop "Treinar questões" → `/treino?subtema=ID` → sessão filtrada **SEM gabarito** (payload limpo, verificado). tsc + 92 testes.
- Autonomia de prod habilitada: o owner adicionou permission rules em `settings.local.json` → `supabase db push` + `vercel deploy` autônomos (git push segue só via @devops/`!`).
- Commits: `7e33f28` (feat) + migrations aplicadas + deploy. Spec: `docs/architecture/drop-2.5-subtema-granular.md`.

## DROP 3 — bloqueado por SOURCING dos PDFs históricos (2026-06-28)
- Infra PRONTA: Seagate montado, disco ~30GB, `parse-fgv.mjs` OK (OCR pdftoppm+tesseract).
- 🔴 BLOQUEIO: backfill histórico (ed1–36, ~2880q) precisa dos PDFs em `/Volumes/Seagate 1/advoga-ingest/raw/oab{N}_{tipo1,gabarito}.pdf`. Só há **ed37–46** lá. `parse-fgv` NÃO baixa — exige os PDFs presentes.
- Doável agora (PDFs presentes): ed37 (re-parse; gabarito 267p sem grid Tipo-1) + ed40 (parseado 79/80; falta fix Q44 + load + tag).
- 3b Validity Engine: downstream do backfill (recentes ≈ vigentes); precisa legal-chief + research Planalto (corte 25/05/2026).
- ⏭️ Decisão do owner: como sourcear os PDFs históricos antes do ultracode de tagging.

## DECISÃO-CHAVE — JANELA DE DADOS: recente (ed37–46) vs histórico completo (2026-06-28)
Pergunta: usar TODO o histórico (Exame I/2010→46, ~3680q, visão do Marcos = mais dado → padrões) ou só os últimos ~5 anos / 10 exames (ed37–46, ~800q, visão da Kamile = recência + lei atual)?
**RECOMENDAÇÃO do Orion: janela RECENTE (ed37–46). A Kamile está certa.** Três razões decisivas:
1. **Não-estacionariedade (a razão DE DADOS, na língua do Marcos):** a "prova" mudou de regime — CPC/2015, Pacote Anticrime/2019, LGPD/2020, reforma trabalhista/2017, jurisprudência STF, + a FGV REESTRUTUROU a prova (incluiu Previdenciário/Financeiro/Eleitoral). Dado antigo é de OUTRA distribuição → adicioná-lo ENVIESA a estimativa de incidência ATUAL. "Mais dado" só reduz variância se for o MESMO jogo; aqui o jogo mudou → adiciona viés.
2. **Rótulos velhos (qualidade > quantidade):** questão pré-reforma tem a "resposta certa" pela lei ANTIGA → estudar nela ensina direito obsoleto (dano ativo p/ a Kamile). Quantidade não conserta rótulo errado.
3. **Tempo/volume:** 800q (ed37–46) já é mais do que ela faz em ~70 dias; o valor do sistema é FOCO, não volume bruto.
**Honra a visão do Marcos SEM os antigos:** a janela recente tem 3+ anos → permite detectar TENDÊNCIA por subtema (subindo/caindo) e TESTAR empiricamente a hipótese de "rotação ~3 anos" dele — com dado atual, sem viés. Se a tendência existir, o cronograma pondera; se não, não assumimos (anti-chute — sem evidência de rotação no R-05, que mostra distribuição estável).
**Drop 3 REESCOPADO:** (a) recuperar **ed37 + ed40** (completa a janela ~800q); (b) camada de **TENDÊNCIA por subtema** (ideia do Marcos, dado recente) = Drop 2 analytics; (c) Validity Engine escopado à janela recente (staleness mínima). **DESCARTAR backfill ed1–36.** Fonte confirmada (R-02): portal OAB/FGV grátis tem as 47 edições, mas não vale ingerir as antigas.

## RESUME — pós-auto-compact (2026-06-28) — ler PRIMEIRO ao retomar
Estado: **Drop 2.5 LIVE + verificado** (https://advoga-mu.vercel.app). Decisão de janela = **RECENTE (ed37–46)**; backfill ed1–36 **DESCARTADO**. Owner (Marcos) aprovou ("ok"). Autonomia de prod ATIVA (`settings.local.json`: `supabase db push` + `vercel deploy` liberados; **git push só via @devops/`!`**). Cloud da Kamile: 640q (8 exames 38,39,41,42,43,44,45,46), cronograma subtema-granular gerado (415 blocos).

**PRÓXIMOS PASSOS (nesta ordem):**
1. **ed40 — fix Q44:** `data/structured/oab40_tipo1.json` tem 80q, mas **Q44 = "[NÃO EXTRAÍDO]"** (OCR pulou na segmentação; **gabarito "C" JÁ presente**; 79 ok). Q44 fica entre Q43 (família, "Rafael e Marta casaram") e Q45 (consumidor, "Carlos contrato de adesão"), **~pág 13 de 24** de `/Volumes/Seagate 1/advoga-ingest/raw/oab40_tipo1.pdf`. CONSERTO: `Read` a página do PDF (leitura visual, melhor que o OCR que falhou) → extrair enunciado + alts A–D da Q44 → `Edit` o JSON. Depois load + tag.
2. **ed37 — re-parse completo:** sem structured (parse falhou: gabarito 267p sem grid Tipo-1). PDFs em `/Volumes/Seagate 1/advoga-ingest/raw/oab37_{tipo1,gabarito}.pdf`. Re-parsear (parse-fgv ou extração manual do gabarito Tipo-1) → load + tag.
3. **Load + tag ed40 e ed37 no CLOUD:** `load-exam` → adicionar a `data/tags/all-tags.json` → aplicar tags (matéria/subtema/dimensões) via classificador (ultracode, 1 exame=80q cada). Aplicar no cloud (`supabase`/migrate) — autorizado.
4. **Camada de TENDÊNCIA por subtema (ideia do Marcos):** incidência por subtema AO LONGO de ed37→46 (série temporal) → detectar subindo/caindo + **testar empiricamente** a hipótese de "rotação ~3 anos" (sem assumir). Feature analytics estilo Drop 2; cronograma pondera tendência se o dado mostrar. @architect → @dev.
5. 640q já LIVE — ed37/ed40 = completude (~800q), não bloqueiam.

## DROP 3 — CONCLUÍDO (2026-06-29) ✅
Tudo autônomo (workflows ULTRACODE + agentes AIOX). **Janela recente COMPLETA: 10 edições (37–46), 800 questões, 800/800 tagueadas.**
- **ed40:** Q44 (OCR pulou a segmentação) extraída por leitura visual (pdftoppm + Claude vision) → 80/80; loaded + tagged (workflow classify→verify).
- **ed37:** descoberto que `oab37_gabarito.pdf` era a **lista de aprovados (267p, doc errado)** → baixado o gabarito oficial FGV (3p, grade Tipo-1 limpa, conferida) + **14 questões OCR-missed** extraídas por workflow de visão (8 agentes lendo páginas) → 80/80; loaded + tagged. Arquivo errado preservado como `oab37_resultado-preliminar.pdf`.
- **Tagging:** workflows classify→verify por lote (prior posição→matéria das 8 eds + taxonomia 192 subtemas). 100% dos slugs/pares validados contra a taxonomia antes de aplicar em prod (anti-chute). +266 questao_tags.
- **Infra:** `apply-tags-batch.mjs` aceita db-url (cloud); novo `scripts/ingest/export-all-tags.mjs`; `all-tags.json` re-exportado do cloud.
- **Anuladas:** 9 (ed38=3, 39=3, 40=1, 43=2) — oficiais FGV, excluídas da prática → `questoes_prova`=791. Gabarito-free intacto (verificado).
- **Tendência/rotação (bloco 4):** hipótese do Marcos testada (permutação 5000×) → **NÃO suportada**; incidência ESTÁVEL; `v_tendencia_subtema` live; planner mantém **incidência cumulativa**. Análise: `docs/analysis/tendencia-subtema-findings.md`.
- **Cronograma da Kamile regenerado** (10 edições): 422 blocos (235 conteúdo + 187 questões subtema-targeted = loop intacto), até 2026-08-30. App lê cloud em runtime → **LIVE sem redeploy**.
- Commits: 9110a6f, 0736fcd, 0a73f1b.
- ⏭️ OPCIONAL (bloco 4 produto): display visual de incidência/estabilidade. Deferido — oferecer ao owner.
