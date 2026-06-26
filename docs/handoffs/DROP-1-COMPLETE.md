# Handoff — DROP 1 (Núcleo de Combate) CONCLUÍDO

> **Data:** 2026-06-21 · **Orquestrador:** Orion · **Status:** DoD COMPLETO, verificado e2e, rodando LOCAL.

## Estado entregue
- **Stack local:** Supabase local (Docker, stack enxuto: db+api+auth+studio) + Next.js 16 (App Router, @supabase/ssr, Recharts, Zustand). `pnpm build` prod verde (11 rotas).
- **Banco (Supabase local, `postgresql://postgres:postgres@127.0.0.1:54322/postgres`):** schema §8.2 com dimensões ABERTAS (EAV) + RLS single-user + views diag_* + `corrigir_sessao` + `questoes_prova` (sem gabarito). Seed: 20 matérias, 192 subtemas, 63 micro, 12 dimensões.
- **Dados:** 42º EOU — 80 questões (OCR), 80/80 tagueadas (matéria+subtema), 144 questao_tags.
- **Usuária dev:** `kamile@advoga.local` / `advoga-dev-2026` (auth local). Rodar: `pnpm dev` → http://localhost:3002.

## Pipeline de ingestão (reutilizável)
- `scripts/ingest/parse-fgv.mjs` — PDF→questões via **OCR** (pdftoppm 300dpi + tesseract `por`, split de 2 colunas). Necessário porque as provas FGV têm fonte de encoding quebrado (texto puro sai embaralhado). Gabarito extrai limpo via pdftotext.
- `scripts/ingest/load-exam.mjs` — carrega JSON estruturado → DB (idempotente).
- `scripts/ingest/apply-tags.mjs` — aplica tags do ultracode → questoes + questao_tags.
- Ultracode workflow (tagging): `.../workflows/scripts/tag-oab-42-wf_*.js` — fan-out classificadores + verificação adversarial.

## Verificação (anti-chute)
- `scripts/smoke-flow.mjs`: corrigir_sessao 7/3 vs gabarito ✅
- `scripts/demo-session.mjs`: sessão 48/80; diagnóstico por matéria + gate ≥8 confirmados (Ética 9 feitas → suficiente; resto insuficiente)
- e2e browser: login → prova sem-gabarito → finalize → resultado (matéria/subtema + revisão) → dashboard (countdown) → planner (plano do dia)

## Pendências / próximos passos
1. **Ingerir 9 edições recentes restantes** (~720 questões) — descobrir URLs dos PDFs (prova Tipo 1 + gabarito) por edição no portal OAB/FGV; rodar parse→load→ultracode. ~38 min OCR + tagging. Enriquece o diagnóstico (mais nós cruzam o gate ≥8).
2. **Refino de tags** (~3-4 matérias trocadas, LLM ~95%) — passes adversariais extras no Drop 2.
3. **@qa formal** (`qa-gate.md`) + **@devops** `*pre-push`/`*push` + **deploy** (Supabase da Kamile + Vercel) — keys via `docs/setup/deploy-credentials.html`.
4. **Drop 2:** dimensões transversais (estilo + §8.5 descobertas) + micro-tópico + cross-axis (subtema×dimensão) + Motor de Descoberta de Variáveis.
5. **Ambiente Consulta** (legislação Planalto + banco pesquisável) — placeholder hoje.

## Notas de infra (lições)
- Disco interno vive ~96-100% cheio → stack supabase local foi enxugado; ingestão/OCR roda no SSD/HD externo (`/Volumes/Seagate 1/advoga-ingest`).
- Docker.raw resetado uma vez (pull falho encheu o disco). Se reabrir, `supabase start` re-sobe.
