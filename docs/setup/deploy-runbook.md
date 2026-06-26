# Deploy Runbook — Advoga para Cloud (Kamile)

**Objetivo:** Colocar o Advoga no ar para Kamile: Supabase cloud dela + Vercel.
**Pré-condição:** Build local verde (`pnpm build`), banco local populado, all-tags.json gerado.
**Estimativa de tempo:** ~20 minutos (excluindo espera do Vercel build).

---

## Env vars necessárias

### Vercel (painel do projeto)

| Variável | Tipo | Onde obter |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (Publishable) | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (Publishable) | Supabase → Settings → API → anon / public |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret (não expor no client) | Supabase → Settings → API → service_role |

> `NEXT_PUBLIC_*` ficam embutidos no bundle JS — use apenas a anon key (publishable).
> A service_role key NUNCA vai para o client. Só é usada em server-side (API routes / seed scripts).

### Script de deploy (temporárias no terminal, descartadas após o comando)

| Variável | Descrição |
|---|---|
| `CLOUD_DATABASE_URL` | Connection string PostgreSQL do cloud (percent-encoded). Obtida em Supabase → Settings → Database → Connection string (URI mode). |
| `CLOUD_SUPABASE_URL` | Mesma que `NEXT_PUBLIC_SUPABASE_URL` |
| `CLOUD_SERVICE_KEY` | Mesma que `SUPABASE_SERVICE_ROLE_KEY` |

---

## Passo a passo

### Passo 1 — Provisionar projeto Supabase para a Kamile

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard) com a conta da Kamile.
2. Crie um novo projeto:
   - **Nome:** `advoga` (ou o que preferir)
   - **Região:** South America (São Paulo) — `sa-east-1` (menor latência para BR)
   - **Password:** anote em local seguro — será usada na `CLOUD_DATABASE_URL`
3. Aguarde provisioning (~2 min).
4. Anote os valores abaixo (Settings → API):
   - Project URL (ex: `https://abcdefgh.supabase.co`)
   - `anon` / `public` key
   - `service_role` key (manter em secret)
5. Anote a connection string (Settings → Database → URI mode):
   - Ex: `postgresql://postgres.abcdefgh:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`

### Passo 2 — Rodar migrate-to-cloud (popula o banco cloud)

Execute no terminal, dentro da pasta `advoga/`:

```bash
CLOUD_DATABASE_URL="postgresql://postgres.xxxx:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" \
CLOUD_SUPABASE_URL="https://xxxx.supabase.co" \
CLOUD_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
node scripts/deploy/migrate-to-cloud.mjs
```

**O script executa automaticamente:**
1. Todas as migrations em `supabase/migrations/` (schema completo)
2. Load APENAS das 8 edições válidas (38, 39, 41-46 → 640 questões). A lista é derivada do `all-tags.json`; a ed. 40 é pulada (ver nota abaixo)
3. Apply de 640 tags de `data/tags/all-tags.json` (offline, sem LLM)
4. Criação da usuária Kamile (`kamile@advoga.local` / `advoga-dev-2026`)
5. Config de metas (`240 min/dia`, `3000 min/mês`, todos os dias)

**Saída esperada (sem erros):**
```
[TAGS-FILE]  ✓ all-tags.json: 640 registros | Edições válidas (8): 38, 39, 41, 42, 43, 44, 45, 46
[MIGRATIONS] ✓ 9 arquivos encontrados, aplicados
[EXAMES]     ✓ 8 arquivos a carregar (de 9 presentes) — PULADO: oab40_tipo1.json
[EXAMES]     ✓ 640 questões inserted/updated
[TAGS]       ✓ 640/640 questões tagueadas
[USER]       ✓ Usuária kamile@advoga.local OK
[METAS]      ✓ metas_estudo: 240min/dia, 3000min/mês
```

> **Edição 40 é deliberadamente EXCLUÍDA (cloud == local):** o `oab40_tipo1.json` existe em `data/structured/`, mas a edição 40 NÃO está no banco local — o parser falhou no Q44 (1 questão malformada) e ela foi propositalmente não carregada por anti-chute. Por isso ela não aparece no `all-tags.json` e o `migrate-to-cloud.mjs` a PULA automaticamente (a lista de edições a carregar é derivada do `all-tags.json`, não do glob de arquivos). Resultado: cloud espelha o local exatamente — 8 edições, 640 questões, 640 tagueadas. Para incluir a ed. 40 no futuro: corrigir o parser do Q44, carregar a edição no local, taguear via workflow e re-exportar o `all-tags.json`.

### Passo 3 — Provisionar projeto Vercel

1. Acesse [vercel.com](https://vercel.com) (conta do Marcos ou da Kamile, conforme acordado).
2. "Add New Project" → "Import Git Repository" → selecione o repositório `advoga`.
3. Framework: **Next.js** (detectado automaticamente).
4. Build command: `pnpm build` (ou deixar Vercel detectar).
5. **NÃO faça deploy ainda** — configure as env vars primeiro.

### Passo 4 — Configurar env vars no Vercel

No painel do projeto Vercel → **Settings → Environment Variables**, adicione:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon/public key) | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key) | Production, Preview |

> Apenas essas 3 variáveis são necessárias. O app não usa outras env vars em runtime.

### Passo 5 — Deploy no Vercel

Opção A (painel): Settings → "Redeploy" (ou trigger via push no repo).

Opção B (CLI):
```bash
vercel --prod
```

Aguarde o build (~3-5 min). URL final será algo como `advoga.vercel.app` ou domínio customizado.

### Passo 6 — Smoke test

Após o deploy estar live, verifique:

```bash
# 1. Health básico: a página carrega?
curl -s -o /dev/null -w "%{http_code}" https://advoga.vercel.app/
# Esperado: 200

# 2. Login da Kamile funciona?
#    Acesse https://advoga.vercel.app → login com kamile@advoga.local / advoga-dev-2026

# 3. Questões carregam?
#    Acesse /pratica → deve mostrar questões OAB

# 4. Dashboard carrega?
#    Acesse /dashboard → deve mostrar métricas (zeradas no início — normal)
```

**Checklist de smoke:**
- [ ] Página inicial carrega sem erro 500
- [ ] Login com `kamile@advoga.local` / `advoga-dev-2026` funciona
- [ ] Sessão de prática exibe questões
- [ ] Dashboard mostra categorias (mesmo que zerado)
- [ ] Console do browser sem erros críticos (CORS, 401, 500)

---

## Troubleshooting

### "supabase db push" falha com "connection refused"

A `CLOUD_DATABASE_URL` está incorreta ou usa porta errada. Supabase cloud usa porta `6543` (pooler) ou `5432` (direct). Tente a URL "direct" (sem pooler) para operações de migração.

### Tags: slugs não encontrados

Se o script reportar slugs não encontrados, o schema de taxonomia no cloud diverge do local. Confirme que as migrations de seed_taxonomy foram aplicadas antes do apply-tags.

### Usuária Kamile não criada (403/400 na Admin API)

A `CLOUD_SERVICE_KEY` está incorreta. Confirme que é a `service_role` key (não a `anon` key).

### Vercel: build falha com "cannot find module"

Rode `pnpm install` localmente e confirme que `pnpm-lock.yaml` está commitado. O Vercel usa o lockfile para instalar dependências.

### NEXT_PUBLIC_SUPABASE_ANON_KEY incorreta

Se o app autentica mas não consegue dados (401 nas chamadas REST), a anon key pode estar errada ou a RLS do Supabase cloud não foi aplicada. Confirme que as migrations de RLS (`20260621120002_rls_single_user.sql`) foram aplicadas.

---

## Referências

- `data/tags/all-tags.json` — export offline das 640 tags (evita re-rodar workflow de ~8M tokens)
- `scripts/deploy/migrate-to-cloud.mjs` — script de deploy idempotente
- `supabase/migrations/` — todas as migrations em ordem
- `scripts/seed-user.mjs` — cria Kamile no Auth
- Backup pg_dump local: `/Volumes/Seagate 1/advoga-db-backup.sql`

---

*Gerado: 2026-06-26 | Gage (@aiox-devops)*
