---
name: deploy-setup
description: Cloud deploy artifacts for Advoga (Kamile) — Supabase cloud + Vercel. all-tags.json, migrate-to-cloud.mjs, env vars, runbook.
metadata:
  type: project
---

Deploy para cloud da Kamile preparado em 2026-06-26. Banco local tinha 640 questões (OAB 38-46 exceto 40), todas tagueadas.

**Why:** Evitar re-rodar workflow de tagging (~8M tokens) no deploy cloud — tags exportadas offline para `data/tags/all-tags.json`.

**How to apply:** Quando o owner entregar as 3 keys (Supabase + Vercel), é 1 comando + 3 env vars no Vercel.

## Artefatos criados

- `data/tags/all-tags.json` — 640 tags exportadas do banco local (115KB). Edições: 38,39,41-46 (80 cada). Ed 40 não tagueada (esperado).
- `scripts/deploy/migrate-to-cloud.mjs` — script Node idempotente: migrations + load-exam + apply-tags + seed-user + seed-metas.
- `docs/setup/deploy-runbook.md` — passo a passo completo.

## Env vars necessárias

Para o script de deploy (temporárias):
- `CLOUD_DATABASE_URL` — PostgreSQL URI do cloud (percen-encoded, pooler port 6543)
- `CLOUD_SUPABASE_URL` — https://<ref>.supabase.co
- `CLOUD_SERVICE_KEY` — service_role key

Para o Vercel (permanentes, 3 vars):
- `NEXT_PUBLIC_SUPABASE_URL` — public, embutida no bundle
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public (anon/publishable key)
- `SUPABASE_SERVICE_ROLE_KEY` — secret, só server-side

## Credenciais da Kamile (app)

- Email: kamile@advoga.local
- Senha: advoga-dev-2026
- Metas seedadas: 240 min/dia, 3000 min/mês, todos os dias

## Nota sobre oab40 (EXCLUÍDA do deploy)

Arquivo `data/structured/oab40_tipo1.json` existe (80 questões) mas a ed. 40 NÃO está no banco local — o parser falhou no Q44 (1 questão malformada) e a edição foi deliberadamente não carregada por anti-chute. Portanto NÃO está no `all-tags.json`.

`migrate-to-cloud.mjs` deriva a lista de edições a carregar do `all-tags.json` (não do glob de arquivos), então a ed. 40 é PULADA automaticamente. Resultado: cloud == local = 8 edições (38,39,41-46), 640 questões, 640 tagueadas.

Para incluir a ed. 40 no futuro: corrigir o parser do Q44 → carregar no local → taguear via workflow → re-exportar `all-tags.json` (a edição entra no deploy automaticamente).

## Backup

Backup pg_dump do banco local em: `/Volumes/Seagate 1/advoga-db-backup.sql`
