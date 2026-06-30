---
name: advoga-uiux-overhaul
description: UI/UX overhaul faseado (0-4) do Advoga — Fase 0 (fundacao) concluida; convencoes de tokens + dark mode
metadata:
  type: project
---

Overhaul UI/UX do Advoga, especificado em `docs/design/ui-ux-proposal.md` (Uma).
Direcao aprovada: **polir o visual limpo existente, NAO restyle**. Exame OAB 2026-09-06, usuaria unica (Kamile).

**Fase 0 (Fundacao) — CONCLUIDA** (commit `feat(ui): fase 0 ...`, master):
- Fonte Geist: removido `body { font-family: system-ui }` de globals.css que bloqueava o Geist.
- Accent de marca: indigo (`#6366f1` dos graficos) em `--primary` + `--ring`, claro+escuro.
- Tokenizacao: ~40 telas migradas de cores hardcoded -> tokens semanticos shadcn.
- Dark mode persistido sem flash.

**Convencoes estabelecidas (seguir nas proximas fases):**
- **Dark mode e hand-rolled, SEM next-themes.** Chave localStorage = `advoga.theme` (`'dark'|'light'`).
  Script anti-FOUC inline no `<head>` do root layout aplica `.dark` em `<html>` antes do paint;
  `<html suppressHydrationWarning>`. Ilha cliente: `src/components/shared/theme-toggle.tsx`
  (icone sol/lua via CSS `dark:` variant = zero hydration mismatch). NAO adicionar next-themes.
- **Neutros** (white/gray) -> tokens adaptativos (`bg-background/bg-card/text-foreground/text-muted-foreground/border-border`) — adaptam sozinhos, sem `dark:`.
- **Cores semanticas/pastel** (status green/red/amber/blue/purple) -> mantem o hue + ganham variante `dark:`
  (ex: `bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900`).
- **CTAs primarios** (eram `bg-blue-600`/`bg-purple-600`) -> `bg-primary text-primary-foreground` (accent). Destructive (Finalizar) fica vermelho.
- Page wrappers full-screen usam `bg-background`; cards `bg-card`; paineis sutis `bg-muted`.

**Pendente para Fase 3 (nao bloqueia):**
- Cores de SERIE dos graficos recharts ainda sao hex hardcoded (legiveis no dark, mas nao token-driven).
  Recharts nao aceita `var()` em atributo `fill` de forma confiavel -> precisa ChartContainer/CSS-var. (proposal §3.4)
- `countdown.tsx` deixado intacto (hero gradiente azul, legivel nos 2 modos) — Fase 3 "acentua".
- Links `text-X-600 hover:text-X-800` tem `dark:` so na base; refino `dark:hover:` fica pro a11y pass (Fase 4).

**Fase 1 (AppShell/nav) — CONCLUIDA** (commit `feat(ui): fase 1 ... AppShell global`, master):
- `src/components/shared/app-shell.tsx` (server, 2 camadas). Tier 1 = `Brand`→/ + `Nav` (4 ambientes) +
  link "Como usar" + `ThemeToggle`. Tier 2 = `SubNav` (sub-rotas do ambiente, prop `secondaryNav`).
- `brand.tsx` (server): wordmark→/, exporta `BRAND_CLASS` p/ reuso onde a marca e `<button>` (runner).
- `nav.tsx` revivido (era dead code): active-state por PREFIXO — cada ambiente lista suas sub-rotas em
  `match[]` (ex: Estudo cobre /plano,/cronograma,/metas,...), ativo = `bg-primary` (accent).
- `sub-nav.tsx` (client, Tier 2): ativo sutil `bg-muted` (hierarquia vs Tier 1 accent).
- Layouts (estudo/verificacao/consulta) agora so renderizam `<AppShell secondaryNav={...}>` —
  removido header local + 4 copias do ThemeToggle (Fase 0). Toggle vive SO no shell agora.
- Home (`page.tsx`) e `/como-usar` (stub RSC) envolvidos no AppShell (Tier 1 only).
- **Teste = excecao foco** (layout `(teste)` SEM header p/ nao duplicar chrome no runner):
  lista `/teste` ganha header slim so com `<Brand>`; no `prova-runner` a marca e `<button>` que abre
  confirm `showExit` (clone do padrao visual do modal "Finalizar prova?") e so faz `router.push("/")`.
  NAO toca finalizeSession/saveResposta/questoes_prova — respostas ja persistem por clique, sair e nao-destrutivo.

**Fase 2 (Onboarding) — CONCLUIDA** (commit `feat(ui): fase 2 — pagina Como usar + tour guiado`):
- `/como-usar` (`src/app/como-usar/page.tsx`, RSC) preenchido: LOOP central (estudar→treinar→
  desempenho→reprioriza, grid 4 passos), cards por feature (Cronograma/Treino/Progresso/Incidencia/
  Dashboard) com "Por que"+"Como usar", bloco rapido Metas/Registro/Materiais, e "Dicas de uso"
  (reusa o tratamento amber do banner-honestidade). Tokens → claro+escuro ok. Botao "Rever tour" no topo.
- **First-run tour** (`src/components/onboarding/`): spotlight custom, ZERO deps novas.
  - `tour-constants.ts`: `TOUR_DONE_KEY='advoga.tour.done'`, `TOUR_EVENT='advoga:start-tour'`.
  - `first-run-tour.tsx` (ilha cliente, montada no AppShell → presente em toda tela nao-teste):
    6 passos (welcome centralizado → ambientes → Estudo/cronograma+treino → theme-toggle → como-usar →
    final). Holofote = `<div>` sobre o alvo com `box-shadow: 0 0 0 9999px rgba(0,0,0,.55)` (1 elemento,
    sem reflow). Alvos via `[data-tour="..."]` (ancoras em nav.tsx grupo+Estudo, theme-toggle, link como-usar).
    Auto-dispara via rAF (evita set-state-in-effect lint) so se `TOUR_DONE_KEY` ausente.
    Pular/Esc/X/fechar gravam o flag; passo final tem checkbox "nao mostrar de novo" (default checked).
    A11y: role=dialog+aria-modal, focus trap (Tab wrap), Esc fecha, motion-safe nas transicoes.
  - `rever-tour-button.tsx` (cliente): dispara `TOUR_EVENT` → replay na mesma pagina (sem limpar flag).
- TS 0, build verde, `/como-usar` prerendered estatico. Seguranca intacta (so arquivos de UI).

**Proximas fases:** 3=polish por tela + a11y + mobile (hamburger no Tier 1 <md; tap targets 44px;
Tier 2 chip-scroll; recharts token-driven), 4=QA gate.
Seguranca: fluxo de teste/`questoes_prova` (gabarito) NAO pode ser tocado em nenhuma fase de UI.
