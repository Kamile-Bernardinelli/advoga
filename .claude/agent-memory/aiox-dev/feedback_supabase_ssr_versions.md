---
name: feedback-supabase-ssr-versions
description: @supabase/ssr versão deve ser 0.12+ para compatibilidade com supabase-js 2.108+
metadata:
  type: feedback
---

O `@supabase/ssr@0.5.x` foi feito para `supabase-js@^2.43.x`. Com `supabase-js@2.108.x`, a API de tipos mudou — `SupabaseClient` ganhou um 5º type param (`ClientOptions`) e a assinatura de `createServerClient` em `ssr@0.5.x` mapeia os 3 params antigos de forma incorreta, fazendo `Schema` resolver como `never` em todas as queries.

**Sintoma:** `Property X does not exist on type 'never'` em qualquer `.from("tabela")`, mesmo com `<Database>` explícito nos factories.

**Fix canônico:** `pnpm add @supabase/ssr@^0.12.0` — que tem peer `supabase-js@^2.108.0` e usa apenas 2 type params no `createServerClient<Database, SchemaName>`.

**Why:** Descoberto ao tentar tipar o projeto advoga. A causa raiz não estava nos factories (que já tinham `<Database>`) mas na incompatibilidade de versões entre `ssr` e `supabase-js`.

**How to apply:** Sempre verificar compatibilidade de versões entre `@supabase/ssr` e `@supabase/supabase-js` antes de debugar tipagem. Par correto: `ssr@0.12+` + `supabase-js@2.108+`.
