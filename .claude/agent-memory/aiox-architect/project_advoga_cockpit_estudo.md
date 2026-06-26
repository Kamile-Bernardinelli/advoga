---
name: advoga-cockpit-estudo
description: Drop 1.5 do Advoga — pilar NOVO de estudo (sensor de tempo + cronograma), complementa o pilar de questões; design em docs/architecture/study-cockpit.md
metadata:
  type: project
---

**Drop 1.5 = Cockpit de Estudo** (pilar NOVO, complementa — não substitui — o pilar de questões). A Kamile passa a ESTUDAR CONTEÚDO + REGISTRAR TEMPO por tema/material/local, para depois cruzar tempo-aplicado × resultado-nas-questões. Design completo: `docs/architecture/study-cockpit.md` (Aria, 2026-06-26).

**Why:** dado de esforço NÃO tem retroatividade — o que não for capturado agora está perdido. Por isso a Fatia 1 prioriza CAPTURA (sensor + roteiro manual) sobre qualquer dashboard. Análise fina do cruzamento = Drop 2.
**How to apply:** ao mexer no pilar de estudo, é 100% ADITIVO (não tocar pilar de questões / `(teste)` / `(verificacao)` / gabarito). Schema novo: `materiais`, `estudo_sessoes` (sensor, log plano, `duracao_min` real NÃO generated p/ entrada manual), `cronograma_blocos` (roteiro). Views: `v_tempo_por_no` (espelha `diag_por_no`) e `v_esforco_resultado` (FULL OUTER JOIN tempo×acerto, gate DUPLO: tempo>=60min E questões>=8). Gerador de cronograma = `src/lib/planner/cronograma.ts`, REUSA `weaknessScore`/`gerarPlano`/`config.ts` (não duplica scoring). Migration aditiva `20260626120000_study_cockpit.sql`.

**Cold-start é requisito:** a Kamile começa com ~zero respostas; `diag_por_no` só traz nós com histórico → a action de cronograma faz merge com o catálogo (matérias+subtemas, nFeitas=0) p/ ordenar por incidência pura até a fraqueza aparecer. Dose de Ética ligada à regra ≥15% do edital (Ética/CED/DH/Filosofia).

**Drift pré-existente flagado (não corrigido):** `src/lib/diagnostico/queries.ts` chama views `v_diagnostico_conteudo/_dimensao/_cross` que NÃO existem — as reais (migrations) são `diag_por_no`, `diag_cross_subtema_dimensao`, `diag_weakness_score`, `v_respostas_corrigidas`. Usar as reais.

**Cockpit v2 = LOOP DE ADERÊNCIA (design 2026-06-26, `docs/architecture/study-cockpit-v2-metas.md`, NÃO implementado).** Aditivo sobre o v1 já construído e funcionando. Adiciona: metas flexíveis (`metas_estudo` singleton: meta_base_diaria_min+meta_mensal_min+dias_estudo+timezone; `metas_diarias` override por dia, 0=folga), função canônica `meta_do_dia(user,data)` (override→base-se-dia-estudo→0), views `v_saldo_diario`/`v_saldo_mensal` (real×meta, saldo acum semana/mês). Migration `20260626130000_metas_aderencia.sql`.
- **Decisão-chave 1:** meta-por-dia no gerador = **swap escalar→lookup** EM CIMA do fix de ordenação do `cronograma.ts` (o `earliestFit(dataMin,minutos)` do dev já empacota dia-a-dia contra um teto; só trocar `budgetDiario` por `budgetDoDia(d)`, add `metaPorDiaMin?` opcional). NÃO reescrever as 2 fases (conteúdo→questões). Compensação/re-plan cai de graça: regenerar-de-hoje (já existe) + metas dos dias futuros maiores re-espalham o conteúdo.
- **Decisão-chave 2:** timer (start/stop) **reusa `registrarEstudo`** — já aceita `inicio`/`fim`; zero action nova. Server recomputa `minutos` de (fim−inicio) no caminho timer (trust boundary). Zustand + localStorage, 1 timer por vez.
- **Decisão-chave 3 (unificação plano-do-dia):** `/plano` vira cockpit de HOJE (blocos do cronograma conteúdo+questões + meta/tempo/saldo no topo); `/cronograma`=horizonte. Planner de questões antigo (`gerarPlano`/`plano_diario`/`ExplicacaoPlano`) é REALOCADO como detalhe do bloco de questões — NÃO apagado (capability preservation).
- **Flag corretude (tz):** views bucketam dia por `ts AT TIME ZONE timezone`; actions atuais usam `new Date().toISOString().slice(0,10)`=UTC → drift à noite no BRT. Código novo deve usar `hojeLocal(tz)`. Fato em SQL, recomendação (ritmo/status atrasada) no app `src/lib/metas/saldo.ts` (puro).

Ver [[advoga-core]], [[advoga-diagnostico-eav]], [[advoga-build-mode]].
