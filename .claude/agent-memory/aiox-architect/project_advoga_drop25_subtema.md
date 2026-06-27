---
name: advoga-drop25-subtema
description: Drop 2.5 do Advoga — cronograma granular por SUBTEMA (incidência real OAB × desempenho) + loop de questões fechado; design em docs/architecture/drop-2.5-subtema-granular.md
metadata:
  type: project
---

**Drop 2.5 = Cronograma Subtema-Granular + Loop de Desempenho** (design Aria 2026-06-27, `docs/architecture/drop-2.5-subtema-granular.md`, IMPLEMENTATION-READY, NÃO implementado). Blocos de estudo passam a nomear o SUBTEMA ("Processo Civil › Cumprimento de sentença"), priorizado por incidência real (COUNT de questões nos exames) × desempenho dela, com loop fechado: estuda → treina questões do subtema → diag recalcula → próximo cronograma re-prioriza fracos.

**Why:** pedido da Kamile — bloco só com a MATÉRIA é vago demais. Tudo data-driven, nunca achismo.
**How to apply:** ao mexer no cronograma/loop, reusar os planners eixo-agnósticos (NÃO reescrever) e migrations aditivas.

**Descobertas-chave (recon, não-óbvias — pouparam reescrita):**
- Os planners (`cronograma.ts` `gerarCronograma`, `planner.ts` `gerarPlano`) JÁ são eixo-agnósticos: cada bloco carrega `eixo`+`noId`; alocação incidência×fraqueza sobre `NoDiagnostico[]` genérico. Só eram alimentados com nós de MATÉRIA.
- `diag_por_no` JÁ tem CTE de subtema completa (eixo='subtema', no_id=subtema_id::text). `diag_weakness_score` NÃO serve p/ incidência de subtema (peso_incidencia só faz JOIN materias quando eixo='materia' → subtema=1 neutro).
- Runner `/teste/[sessaoId]` lê SÓ de `questoes_prova` (sem gabarito) → treino filtrado por subtema herda a fronteira de segurança de graça. `corrigir_sessao`/`resultado` são exame-agnósticos (operam por sessaoId); resultado já tem badge "amostra insuficiente <8" por subtema.
- `NoDiagnostico` NÃO tinha campos de subtema/matéria (a recon errou nisso) — só `CronogramaBloco` tem materiaNome/subtemaNome.

**Decisões travadas:** D-A incidência = COUNT BRUTO (view `v_incidencia_subtema`, sem normalizar — `weaknessScore` já normaliza e alocação é proporcional/scale-invariant). D-B cronograma gera SUBTEMA; matéria = fallback só p/ matérias sem subtema cobrado (capability preservation; mesma unidade questões/exame → mistura justa). D-C Ética por MATÉRIA-PAI (flag `eEtica` no nó, setada pela action via `nomeEhEtica(materia_nome)`; subtema "Honorários" não casa ETICA_RE). D-D loop reusa o runner + 1 coluna aditiva `sessoes.subtema_id` (não criar runner novo). D-E `incidenciaMax` fica 20 (não recalibrar). D-F `gerarPlano`/`plano_diario` ficam matéria-level (loop roda pelo cronograma+treino; subtema no plano = parking lot).

**Anti-chute:** cold-start = incidência-led (nFeitas<8 → weaknessScore null → usa pesoIncidencia); gate ≥8 em 2 camadas (view+app); zero subtema hardcoded (universo 100% da view); único "hardcode" = ETICA_RE (política do edital ≥15%, não dado).

Migrations: `20260627120000_incidencia_subtema.sql` (view, security_invoker=on) + `20260627120001_sessao_subtema_treino.sql` (sessoes.subtema_id). Ver [[advoga-cockpit-estudo]], [[advoga-diagnostico-eav]], [[advoga-core]].
