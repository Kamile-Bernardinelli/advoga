Orion (aiox-master), RETOME a orquestração do ADVOGA — sistema de estudos OAB 1ª fase, data-driven, single-user (Kamile). Esta é a CONTINUAÇÃO de uma sessão anterior que esgotou o contexto. Leia o estado abaixo + os docs, confirme o ambiente, reporte ao owner (Marcos) e siga. NÃO faça grandes despaches sem o OK dele.

═══ FONTE DA VERDADE (leia nesta ordem) ═══
1. docs/00-ORION-PLAN.md (estado/plano vivo — atualize-o a cada fase)
2. docs/handoffs/DROP-1-COMPLETE.md + ESटE arquivo (docs/handoffs/HANDOFF-CONTINUACAO.md)
3. docs/architecture/fullstack-architecture.md · SCHEMA.md · study-cockpit.md · study-cockpit-v2-metas.md
4. docs/setup/deploy-runbook.md + docs/setup/deploy-credentials.html (cockpit de keys)
5. docs/research/edital-47-ingested.md + data/sources/edital-47-marcos.json
6. PRD original (mega-brain): /Users/admin/code/the-brain/mega-brain-premium/workspace/personal/kamile-oab/{01-BRIEF,00-BRAINDUMP-RAW,02-RESEARCH-exam-and-sources,HANDOFF-AIOX}.md  (verbatim do 00 vence em conflito; anti-chute = §4 do BRIEF)

Build vive em /Users/admin/code/apps/_active/advoga. Stack: Next.js 16 (App Router) + Supabase + Vercel. Prova 06/09/2026.

═══ ESTADO ATUAL (feito + verificado no browser) ═══
• DROP 1 (Núcleo de Combate) COMPLETO: 8 edições FGV (38,39,41,42,43,44,45,46) = 640 questões, 640 TAGUEADAS (matéria+subtema+dimensões, via ultracode c/ verificação adversarial). Ambiente de Teste (prova sem-gabarito + timer), correção (fn SQL corrigir_sessao), diagnóstico matéria/subtema (gate ≥8), dashboard + countdown, planner.
• DROP 1.5 (Cockpit de Estudo) COMPLETO (Fatia A+B): /cronograma (conteúdo+questões, prioridade por incidência×fraqueza, conteúdo antes de questões), /registro (log de tempo), /plano (cockpit do dia: meta+saldo+timer por bloco), /metas (meta base+mensal+override por dia+dias de estudo+fuso+COMPENSAÇÃO 1-clique), /materiais (CRUD + material_id), /progresso (tempo por matéria), gráficos Recharts. Saldo/compensação + meta mensal funcionando.
• Banco local: schema + RLS single-user + views diag_por_no / diag_cross_subtema_dimensao / diag_weakness_score / v_tempo_por_no / v_esforco_resultado. Migrations em supabase/migrations/ (0000..130000). Tags persistidas em data/tags/all-tags.json (640, 8 edições — SEM ed40).
• DEPLOY PREPARADO (falta só keys): scripts/deploy/migrate-to-cloud.mjs (idempotente, allowlist de 8 edições derivada do all-tags.json, NÃO re-roda tagging). Runbook em docs/setup/deploy-runbook.md.

═══ PRÓXIMO PASSO IMEDIATO = DEPLOY (escolha do owner) ═══
BLOQUEADO em: keys da Kamile (Supabase da conta DELA + Vercel) — owner preenche docs/setup/deploy-credentials.html / .env (NUNCA cole keys no chat). Quando ele disser "vai":
  CLOUD_DATABASE_URL=... CLOUD_SUPABASE_URL=... CLOUD_SERVICE_KEY=... node scripts/deploy/migrate-to-cloud.mjs
  depois 3 env vars no Vercel (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) + `vercel --prod`. SÓ @devops (Gage) executa deploy/push. Migrate aplica schema + carrega as 8 edições + tags (offline) + Kamile + metas.

═══ ROADMAP RESTANTE ═══
• DROP 2 (profundidade): UI de ESFORÇO×RESULTADO (view v_esforco_resultado JÁ captura tempo×acerto por nó — falta a tela de quadrantes); cross-axis subtema×estilo (view diag_cross_subtema_dimensao existe); MOTOR DE DESCOBERTA DE VARIÁVEIS (§8.5 do BRIEF — minerar as questões que a Kamile ERROU e propor dimensões novas). [ULTRACODE: mineração dos erros = fan-out quando houver volume de respostas dela.]
• DROP 3 (histórico+validade): backfill das ~36 edições antigas (Exame I/2010 → 36) com parse-fgv.mjs (OCR; `EXAME=N ANO=Y node scripts/ingest/parse-fgv.mjs`) → load-exam → tagging via ultracode. [ULTRACODE: ~2880 questões = grande fan-out — ver lição #5.] + MOTOR DE VALIDADE LEGAL vs Planalto (corte 25/05/2026) marcando desatualizada/anulada.
• PONTAS: re-parsear ed40 (Q44 falhou no OCR — 79/80) + ed37 (gabarito é doc combinado 267p sem grid Tipo-1 → achar fonte limpa); drift de fuso UTC em cronograma.actions.ts/planner.actions.ts (usar hojeLocal(tz)); lib/diagnostico/queries.ts aponta p/ views v_diagnostico_* INEXISTENTES (reais: diag_por_no); E2E gabarito-nao-vaza (QA P2); re-plan automático ao mudar override.

═══ GOTCHAS OPERACIONAIS (críticos) ═══
1. Docker/Supabase local: a VM do Docker CAI na troca de sessão/relogin. Recuperar: `open -a Docker` → esperar daemon → `supabase start`. Se status mostrar serviços "Stopped" mas DB up: `supabase stop` + `supabase start` (volume/dados PERSISTEM). **NUNCA `supabase db reset`** — as 640 questões + tags vieram por SCRIPT, não por migration → reset APAGA tudo. Backup: /Volumes/Seagate 1/advoga-db-backup.sql.
2. Disco interno vive ~96-100% cheio. OCR/ingestão pesada → drive externo /Volumes/Seagate 1/advoga-ingest. Disco cheio TRAVA o Docker.
3. `supabase gen types typescript --local` às vezes vaza 2-3 linhas de stderr pro db.types.ts e quebra o tsc — remover as linhas-lixo.
4. Provas FGV têm fonte de encoding quebrado → o parser usa OCR (pdftoppm -r 300 + tesseract -l por, split de 2 colunas a ~0.5). pdftotext só presta pro GABARITO.
5. ULTRACODE é RESUMÍVEL: fan-out grande bate rate-limit do servidor OU limite de sessão. Re-invoque Workflow({scriptPath, resumeFromRunId}) — agentes completos ficam em cache, só os que falharam re-rodam. Foi assim que o tagging das 560 convergiu (3 resumes).
6. Ambiente: DB local = postgresql://postgres:postgres@127.0.0.1:54322/postgres · app = `pnpm dev` (porta 3000/3001) · login dev = kamile@advoga.local / advoga-dev-2026 · Kamile user_id = ea7c5c9d-5bf3-402b-a3bb-0fed4a015685.

═══ POLÍTICA DO OWNER ═══
• Modelos: OPUS p/ você (orquestração/decisão) + @architect (design) + legal-chief (taxonomia jurídica). SONNET p/ mecânico (@dev implementando, @data-engineer migrations, classificadores do ultracode). ANUNCIE toda troca de modelo.
• Use ULTRATHINK em decisões de arquitetura/sequência. Use ULTRACODE (Workflow, fan-out) em lote (tagging, mineração de erros, backfill histórico) — nunca 1-agente-por-item em série.
• Anti-chute: nenhuma afirmação "fraca em X" sem dado; gate ≥8. Secrets só em .env. SÓ @devops dá push/deploy. VERIFIQUE no browser antes de declarar pronto. Documente handoff ao fim de cada fase no docs/00-ORION-PLAN.md.
• Agentes AIOX via Agent tool (subagent_type): aiox-architect, aiox-data-engineer, aiox-dev, aiox-analyst, aiox-qa, aiox-devops, aiox-sm, aiox-po, aiox-pm + legal-chief. Comandos/args reais via task files em .aiox-core/development/tasks/.

PRIMEIRO PASSO: confirme o ambiente (suba o Supabase se preciso; `pnpm dev`; cheque /plano e /metas logado como Kamile). Reporte ao owner o que está de pé e PERGUNTE: ele já tem as keys da Kamile (Supabase+Vercel) p/ DEPLOY agora, ou seguimos pro Drop 2 / pontas? Aguarde o OK antes de grandes despaches.
