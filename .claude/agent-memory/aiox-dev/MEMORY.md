# Agent Memory Index — Dex (@aiox-dev) / Advoga

- [Project Scaffold State](project_scaffold_drop1.md) — Drop 1 scaffold concluído: Next 16.2.9 + Supabase SSR + 4 route groups + build passando
- [Feedback Next.js 16 Conventions](feedback_nextjs16.md) — Next 16 usa `proxy.ts` com export `proxy` em vez de `middleware.ts`
- [FGV PDF Parser — OCR Pipeline](project_fgv_parser.md) — OCR validado: pdftoppm 300dpi + tesseract -l por, 2 colunas, skip pg 1 e ultima. Gotchas: "75"→"15", pg 20 pesquisa. 227s/exame.
- [Supabase SSR Version Compat](feedback_supabase_ssr_versions.md) — ssr@0.5.x + supabase-js@2.108.x = tipo `never` em queries. Fix: ssr@0.12+.
- [Supabase gen types lixo](feedback_supabase_gentypes_junk.md) — gen types (CLI v2.75) grava stderr no db.types.ts e quebra tsc; remover 3 linhas-lixo após regen.
- [Cockpit v2 Fatia A+B](project_cockpit_v2_drop1_5.md) — /metas + compensação + /materiais + /progresso + Recharts. 316 testes, build verde. Smoke 2026-06-26.
