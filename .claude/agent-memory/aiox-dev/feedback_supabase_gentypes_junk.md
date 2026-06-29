---
name: supabase-gentypes-junk
description: Como regenerar db.types.ts no advoga — rota --project-id (Management API) é a boa; --local/--db-url exigem Docker; --local polui stdout
metadata:
  type: feedback
---

Regenerar `src/lib/types/db.types.ts` no advoga. Há 3 rotas e só uma é confiável aqui:

**ROTA BOA — `--project-id` (Management API, HTTPS, SEM Docker):**
```bash
set -a; . ./.env 2>/dev/null; set +a   # carrega SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN (ambos no .env)
supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public,graphql_public > /tmp/new.ts 2>/tmp/err.txt
```
- Escreve o aviso de versão do CLI no **stderr** (não no arquivo) → SEM lixo no stdout. Arquivo já sai limpo.
- `--schema public,graphql_public`: o default (só `public`) **dropa** o schema `graphql_public` que o arquivo original tinha → diff fica não-aditivo. Incluir os dois mantém o diff **puramente aditivo** (só a view nova). (graphql_public é inerte p/ o app, mas evita susto no review.)
- Gere p/ TEMP, valide (grep das views novas + contagem de entidades + sem junk), e só então `cp` por cima. Nunca redirecione direto no arquivo real.

**ROTAS RUINS:**
- `--local` / `--db-url`: o CLI v2.75 **exige Docker** mesmo com `--db-url` (`failed to inspect docker image... Is the docker daemon running?`). Se o Docker foi removido (o caso atual do advoga), falha com exit 1 e gera arquivo **vazio**. Por isso gere p/ temp.
- `--local` (quando Docker existe): mistura stderr no stdout, gravando 3 linhas-lixo NO ARQUIVO (`Connecting to db 5432` no topo; `A new version...`/`We recommend...` no fim) que quebram o tsc (`error TS1434`). Aí sim precisa remover as 3 linhas.

**Why:** rotas diferentes do mesmo comando têm comportamentos de I/O e dependências diferentes; a Management API não roda pg_dump em container.

**How to apply:** Sempre preferir `--project-id` no advoga. `db.types.ts` é NÃO-TOCAR p/ edição manual de schema, mas regenerar via CLI é correção sancionada. Verificar `npm run typecheck` (0 erros) após — confirma que nenhum consumidor quebrou. Relacionado: [[supabase-ssr-versions]], [[project-advoga-incidencia-drop4]].
