# Advoga

> Guia master de estudos OAB 1ª fase, data-driven, pessoal. Usuária: **Kamile**. Prova-alvo: **06/09/2026**.
> **Status:** PRÉ-BUILD — aguardando squad AIOX. **NÃO confundir** com `kamile-crm`.

## ⚠️ Entrada para a squad AIOX

Os documentos canônicos (fonte da verdade) vivem no mega-brain, **não** aqui — para não duplicar/divergir:

```
the-brain/mega-brain-premium/workspace/personal/kamile-oab/
├── HANDOFF-AIOX.md      ← COMECE AQUI. Sequência de agentes, comandos, ultracode.
├── 01-BRIEF.md          ← O PRD (autoritativo).
├── 00-BRAINDUMP-RAW.md  ← Verbatim do owner + Kamile (vence em conflito).
└── 02-RESEARCH-…md      ← Fatos verificados (datas, fontes, pesos, GAPS).
```

## Quick facts
- **Stack:** Next.js + Supabase (**conta da Kamile**) + Vercel.
- **MVP:** recente-first, 3 drops. Drop 1 = teste sem-gabarito + correção + diagnóstico + planner + countdown.
- **Espinha:** motor de diagnóstico granular (matéria→subtema→micro) + **dimensões transversais ABERTAS** + Motor de Descoberta de Variáveis.
- **Orquestra:** `@aios-master` (Orion). Lifecycle: `@sm → @po → @dev → @qa → @devops`.

## Setup pendente (bloqueia Drop 1)
- `.env` com `PROJECT_REF` + keys do Supabase **da Kamile** (gitignored, nunca commitar).
