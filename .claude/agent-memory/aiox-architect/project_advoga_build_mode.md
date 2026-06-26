---
name: advoga-build-mode
description: Estratégia LOCAL-FIRST do Advoga — build 100% local (Supabase Docker + Next dev), cloud só no deploy, migrations idênticas, troca via .env
metadata:
  type: project
---

Advoga é **LOCAL-FIRST** (estratégia do Orion, aprovada 2026-06-21):
- **Build:** Supabase local (Docker, `supabase start`) + Next.js dev + PDFs públicos. **Zero cloud key durante o build.**
- **Cloud só no deploy:** Supabase **da Kamile** + Vercel. Promover = trocar valores no `.env` (local) / Vercel env vars (cloud) + `supabase db push`. **Migrations idênticas local↔cloud, zero retrabalho.**

**Why:** dados de estudo são da Kamile (D-03); e não bloquear o build esperando keys dela.
**How to apply:** ao desenhar/implementar, assumir Postgres local. Código lê SEMPRE as mesmas env vars (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — nenhuma branch de código por ambiente.

**Regra de segredo (dura):** `service_role` JAMAIS com prefixo `NEXT_PUBLIC_`. Só server-side (Server Actions/ingestão) e Vercel env var server-scope. `.env` é gitignored.

**Deploy/push = EXCLUSIVO do @devops (Gage).** Architect/dev só desenham/implementam. Keys da Kamile entram pelo cockpit `docs/setup/deploy-credentials.html`.

`frameworkProtection: false` no `core-config.yaml` deste projeto — deny rules de boundary estão DESATIVADAS aqui. Ver [[advoga-core]].
