---
name: supabase-gentypes-junk
description: supabase gen types (v2.75) escreve lixo de stderr no db.types.ts e quebra o tsc
metadata:
  type: feedback
---

`supabase gen types typescript --local > db.types.ts` (CLI v2.75) mistura stderr no stdout, gravando 3 linhas-lixo NO ARQUIVO que quebram o `tsc`:
- topo: `Connecting to db 5432`
- fim: `A new version of Supabase CLI is available...` + `We recommend updating...`

**Why:** o CLI manda mensagens de diagnóstico pro stdout em vez de stderr; o redirect `>` captura tudo. Resultado: `db.types.ts(1,1): error TS1434` e erros no fim do arquivo.

**How to apply:** Após qualquer regen de tipos, remova essas 3 linhas (topo + 2 do fim) — o resto do arquivo é válido. `db.types.ts` é NÃO-TOCAR para edição manual de schema, mas remover o lixo de CLI é correção obrigatória, não edição de schema. Alternativa: `2>/dev/null` no redirect (pode ser bloqueado pelo sandbox se sobrescrever arquivo protegido). Relacionado: [[supabase-ssr-versions]].
