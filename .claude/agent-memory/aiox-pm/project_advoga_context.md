---
name: project-advoga-context
description: Contexto central do projeto Advoga — sistema de estudos OAB 1ª fase para Kamile. Prova 06/09/2026. Decisões travadas, stack, drops MVP, DoD Drop 1.
metadata:
  type: project
---

Sistema chamado **Advoga** (`apps/_active/advoga/`). Guia master de estudos OAB 1ª fase data-driven para Kamile (namorada do Marcos, concluindo Direito UCDB).

Prova: 47º EOU 1ª fase, **06/09/2026** (77 dias desde 21/06/2026). Corte legislativo: 25/05/2026.

**Why:** Kamile precisa de diagnóstico granular (não cursinho) para estudar de forma cirúrgica em 77 dias. Lema: "brutalmente realista, com base em dados."

**Decisões travadas (não reabrir sem Marcos):**
- D-03: Next.js + Supabase (conta da Kamile, não do Marcos) + Vercel. Single-user RLS. Keys via `.env`.
- D-04: Desktop-first.
- D-06: Dimensões transversais = conjunto ABERTO + Motor de Descoberta (§8.5).
- D-07: Nome = Advoga.

**MVP 3 drops:**
- Drop 1 (EP-1): ~10 edições recentes (~800q) + Teste + Correção + Diagnóstico matéria/subtema + Dashboard + Countdown + Planner v1.
- Drop 2 (EP-2): micro-tópico + dimensões transversais + cross-axis + Motor de Descoberta.
- Drop 3 (EP-3): backfill 46 edições + Motor de Validade Legal (Planalto 25/05/2026).

**DoD Drop 1:** Kamile abre prova real → responde sem gabarito → finaliza → vê acertos/erros por matéria/subtema → vê countdown → recebe plano do dia. Ponta-a-ponta com dados reais.

**Gate anti-chute:** nó só vira "fraqueza" com ≥ 8 questões. Abaixo: "amostra insuficiente".

**Fontes primárias:** `mega-brain-premium/workspace/personal/kamile-oab/01-BRIEF.md` (autoritativo), `HANDOFF-AIOX.md`, `00-BRAINDUMP-RAW.md`.

**How to apply:** Sempre referenciar o DoD Drop 1 como critério de priorização. Nunca reabrir D-01..D-07 sem Marcos. Gate de volume ≥ 8 é inegociável (princípio anti-chute).
