---
name: project-advoga-schema
description: Advoga DB design contracts — open-dimension EAV model, anti-chute volume gate, single-user RLS. Read before touching schema or diagnostics.
metadata:
  type: project
---

Advoga = data-driven OAB 1st-phase study guide, single-user (Kamile). Schema lives in
`supabase/migrations/2026062112000{0,1,2}_*.sql`; doc in `docs/architecture/SCHEMA.md`.
Canonical source: `the-brain/.../kamile-oab/01-BRIEF.md` §8.

**Load-bearing design contracts (do NOT violate without owner sign-off):**

1. **Dimensões transversais = conjunto ABERTO (D-06).** Adding an analysis axis is an
   INSERT into `dimensoes` (+ `dimensao_valores` if categorical) + `questao_tags` rows —
   NEVER an `ALTER TABLE`. EAV: `questao_tags` has 3 value cols (`valor_id`/`valor_bool`/
   `valor_num`) with a CHECK that exactly one is set, keyed by `dimensoes.tipo`.
   This is the heart of the Motor de Descoberta (§8.5). Diagnostic views pick up new
   dimensions automatically (eixo = `dimensoes.chave`).
   **Why:** owner directive 2026-06-21; "estilo" is just one example axis.
   **How to apply:** if asked to "add a dimension/variable", reach for INSERTs, not DDL.

2. **Anti-chute volume gate (§4).** Never declare a weakness with small sample. Gate is
   `public.diag_gate_minimo()` = 8, exposed as the explicit boolean column
   `amostra_suficiente` on every diag view. The gate is in the VIEWS, not the schema.
   **Why:** brutal-realism principle — data must never hide sample size.
   **How to apply:** app/QA must filter `amostra_suficiente = true` before labeling a
   target; `weakness_score` only meaningful when true.

3. **Single-user RLS, multi-user ready (D-01).** User-data tables (`sessoes`, `respostas`,
   `plano_diario`) have RLS + `auth.uid() = user_id` (full CRUD policies). Content tables
   (materias, subtemas, micro_topicos, dimensoes, dimensao_valores, exames, questoes,
   questao_tags) have RLS + SELECT-only for `authenticated`; writes go through
   `service_role` (ingestion/ultracode bypasses RLS). `respostas.user_id` is denormalized
   from `sessoes` and kept correct by trigger `sync_resposta_user_id` (forge-proof).
   **Why:** Supabase exposes all public tables via PostgREST; RLS-on is mandatory.

4. **`questoes.dificuldade` is empirical & NULLABLE** (derived from % correct, filled by a
   job). **`respostas.correta` is persisted** (snapshot at correction time), NULL until the
   session is finalized (§7 releases gabarito).

5. **Enums for closed domains, EAV for open.** Enums: `grupo_materia`, `dimensao_tipo`,
   `validade_status`, `tipo_prova`, `sessao_tipo`, `tag_origem`. Dimensions are NOT enum.

6. **Comentário (explicação) = answer-revealing, treated EXACTLY like `gabarito`** (migration
   `20260629153405_comentarios.sql`). Stored in its OWN table `public.comentarios`
   (`questao_id` UNIQUE FK 1:1, `comentario` NOT NULL, `fonte` null, `gerado_por` text
   default 'llm'), NOT a column on `questoes` — so it has an independent GRANT surface and
   can never leak via a `SELECT * FROM questoes` or via `questoes_prova`. RLS mirrors
   `questoes` 1:1: RLS ON+FORCE, single policy `comentarios_read_authenticated`
   (SELECT/authenticated/USING true), NO write policy → writes only via service_role
   (the legal-generation workflow). **Generator INSERTs into `public.comentarios
   (questao_id, comentario, fonte, gerado_por)` with `ON CONFLICT (questao_id) DO UPDATE`,
   using service_role.** Read surface for `/resultado` = view `v_resultado_comentario`
   (security_invoker=on) built on `respostas JOIN sessoes ON fim IS NOT NULL` → structurally
   post-answer, own-rows-only. `questoes_prova` is unchanged (16 cols, no gabarito/comentário)
   and `comentario` is in `COLUNAS_RESPOSTA_PROIBIDAS` (test-enforced by
   `tests/unit/gabarito-nao-vaza.test.ts`).
   **Non-obvious security reality (verified 2026-06-29):** `authenticated` HAS `SELECT` on
   `questoes` incl. `gabarito` (no column REVOKE). Test-time protection is the
   `questoes_prova` view convention + the `/resultado` redirect when `sessoes.fim IS NULL`,
   NOT a hard column grant. Hardening (REVOKE SELECT during active session) is DEFERRED to
   Drop 2+ — when applied, do it symmetrically to BOTH `gabarito` and `comentarios`.

Open alignment items with @architect: re-gabaritagem policy on question annulment;
when to promote `diag_por_no` to MATERIALIZED VIEW. See SCHEMA.md §8.
