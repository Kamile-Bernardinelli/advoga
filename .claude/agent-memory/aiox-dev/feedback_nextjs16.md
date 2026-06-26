---
name: feedback-nextjs16-proxy
description: Next.js 16 depreciou middleware.ts em favor de proxy.ts com export nomeado "proxy"
metadata:
  type: feedback
---

No Next.js 16 (Turbopack), o arquivo `middleware.ts` foi depreciado. A convenção correta é:

1. Arquivo: `src/proxy.ts` (em vez de `src/middleware.ts`)
2. Export: `export async function proxy(request: NextRequest)` (em vez de `middleware`)
3. `config` com `matcher` permanece igual

**Why:** O build do Next 16 lança erro `Proxy is missing expected function export name` se o arquivo se chama `proxy.ts` mas exporta `middleware`. E lança warning de depreciação se o arquivo ainda se chama `middleware.ts`.

**How to apply:** Sempre que criar ou orientar sobre middleware em projetos Next.js 16+, usar `proxy.ts` com export `proxy`.
