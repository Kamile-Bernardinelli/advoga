---
name: advoga-core
description: O que é o Advoga, restrição-mãe (prova 06/09/2026), decisões travadas D-01..D-07, e a fronteira de segurança nº1 (gabarito não vaza antes do finalize)
metadata:
  type: project
---

**Advoga** = guia de estudos OAB 1ª fase, data-driven, **single-user** (usuária: Kamile; owner: Marcos). Não é cursinho — é motor de diagnóstico anti-chute.

**Restrição-mãe:** prova **06/09/2026** (eram 77 dias em 2026-06-21). Toda decisão de escopo é subordinada a "isto faz a Kamile resolver mais questões reais com correção granular, mais cedo?".

**Why:** prazo apertado → MVP cirúrgico, pragmatismo vence elegância. Sem Turborepo, sem microsserviços, sem fila — Postgres + Next.js resolvem.
**How to apply:** ao sugerir qualquer peça de infra/arquitetura no Advoga, justifique contra o DoD do Drop 1. Se não acelera, vai pro parking lot.

**Decisões TRAVADAS (não redecidir):** Next.js App Router + Supabase + Vercel (D-03, Supabase na conta DA KAMILE); single-user RLS por auth.uid(); desktop-first responsivo (D-04); dimensões transversais = conjunto ABERTO via EAV (D-06); nome=Advoga (D-07); 1ª fase agora + schema pronto p/ 2ª fase peças/Tributário (D-01).

**FRONTEIRA DE SEGURANÇA Nº1:** o `gabarito` NUNCA chega ao client antes do `finalize` da sessão. É segurança, não UX. Defense in depth: view `questoes_prova` (sem coluna gabarito) + correção só em Server Action `finalizeSession` (service_role server-only) + teste E2E `gabarito-nao-vaza.spec.ts` que falha o build se a letra vazar.

Fontes da verdade: `the-brain/mega-brain-premium/workspace/personal/kamile-oab/01-BRIEF.md` (§8 é canônico p/ schema), `HANDOFF-AIOX.md`, `docs/00-ORION-PLAN.md`. Ver [[advoga-build-mode]] e [[advoga-diagnostico-eav]].
