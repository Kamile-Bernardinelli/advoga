---
name: project-scaffold-drop1
description: Estado do scaffold do Drop 1 (EP-0 Fundação) — Next 16.2.9 rodando, estrutura de pastas completa, build e typecheck passando
metadata:
  type: project
---

Scaffold do app Advoga concluído em 2026-06-21 (EP-0 Drop 1).

**Estado:** Build passando, lint limpo, 10/10 testes unitários verdes.

**Stack instalada:**
- Next.js 16.2.9 (Turbopack default)
- React 19.2.4
- TypeScript 5.9.3
- Tailwind CSS 4.3.1
- shadcn/ui 4.11.0 (copy-in, components.json gerado)
- @supabase/ssr 0.5.2 + @supabase/supabase-js 2.108.2
- Zustand 5.0.14, @tanstack/react-query 5.101.0, Zod 3.25.76
- Recharts 3.8.1, clsx 2.1.1, tailwind-merge 3.6.0
- Vitest 2.1.9

**Estrutura criada:** `/Users/admin/code/apps/_active/advoga/src/`

4 route groups ativos: `(teste)`, `(estudo)`, `(consulta)`, `(verificacao)`

Clientes Supabase em `src/lib/supabase/`: server.ts, action.ts, service.ts, client.ts, middleware.ts

Lógica pura: `lib/diagnostico/` (weakness-score, volume-gate, queries), `lib/planner/` (planner + config com gateVolume=8, velocidadeQhDefault=30), `lib/correcao/`

**Why:** Prova OAB 06/09/2026 — 77 dias, local-first (Supabase Docker), deploy = trocar .env.

**How to apply:** Proxima story: implementar lógica real das Server Actions (startSession, saveResposta, finalizeSession). Schema migrations já existem em `supabase/migrations/`.

**Pendências do scaffold:**
1. `.env.local` tem as chaves default do Supabase local — confirmar com `supabase status` quando o Docker subir
2. `supabase gen types typescript --local > src/lib/types/db.types.ts` após migrations rodarem
3. Migrations ainda não aplicadas (supabase não está rodando localmente ainda)
