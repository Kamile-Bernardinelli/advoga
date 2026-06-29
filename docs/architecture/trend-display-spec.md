# Implementation Spec — "Incidência & Tendência por Subtema" (painel descritivo)

**Autor:** Aria (@architect) · **Data:** 2026-06-29 · **Executor alvo:** @dev (Dex) · **1 passe**
**Fonte do veredito:** `docs/analysis/tendencia-subtema-findings.md` (Dara, 2026-06-28)
**Migrations base (já aplicadas na cloud):**
`20260627120000_incidencia_subtema.sql` (`v_incidencia_subtema`, cumulativa) ·
`20260628201154_tendencia_subtema.sql` (`v_tendencia_subtema`, por edição)

---

## 0. TL;DR para o @dev

Construir **uma página nova** `/incidencia` no ambiente `(verificacao)` que mostra:
1. Um **banner honesto** (não-dismissível, no topo): incidência é **estável**, a hipótese de rotação foi **testada e rejeitada**, este painel é **descritivo, não preditivo**.
2. **4 cards de resumo** (subtemas cobrados, questões na janela, edições, "Estável →").
3. Um **gráfico recharts** de ranking dos top-15 subtemas por incidência (espelha `grafico-materias.tsx`).
4. Uma **tabela ranqueada** (top-40) com, por linha: incidência (barra+nº), **sparkline CSS por edição** (mostra a planura, com os zeros densificados), respondíveis-agora, e deep-link "Treinar".
5. **Nav** adicionada ao layout `(verificacao)` (hoje não tem) com `Dashboard | Incidência`.

**Natureza do trabalho:** RSC-first, aditivo, leitura de 2 views read-only sem `user_id` (corpus-level, aggregate-safe — sem gabarito/enunciado). Nenhuma mudança de schema. Nenhum risco de backward-compat.

> **Regra-mãe deste painel (ANTI-CHUTE):** nunca, em texto, cor, seta ou ordenação, sugerir que dá para **prever qual subtema "vai cair"**. O dado real (`tendencia-subtema-findings.md` §4) mostra movimento **igual ou menor que o acaso**. Tudo aqui é "o que JÁ caiu", descritivo. Guardrails concretos na §7.

---

## 1. Route / File structure (paths exatos)

| # | Arquivo | Ação | Tipo | Papel |
|---|---------|------|------|-------|
| 0 | `src/lib/types/db.types.ts` | **REGENERAR** | gerado | adiciona `Row` de `v_tendencia_subtema` (hoje ausente) — ver §6 |
| 1 | `src/lib/types/domain.ts` | EDIT (append) | — | tipos de domínio camelCase (§6) |
| 2 | `src/lib/incidencia/tendencia.ts` | **NEW** | pure lib | densificação dos zeros + montagem do ranking (testável) |
| 3 | `src/lib/incidencia/tendencia.test.ts` | **NEW** (recomendado) | vitest | testa densificação/eixo/ordem (§8) |
| 4 | `src/app/(verificacao)/incidencia/page.tsx` | **NEW** | RSC | fetch + composição |
| 5 | `src/app/(verificacao)/incidencia/banner-honestidade.tsx` | **NEW** | RSC | o banner anti-chute |
| 6 | `src/app/(verificacao)/incidencia/grafico-incidencia.tsx` | **NEW** | `"use client"` | gráfico recharts do top-15 |
| 7 | `src/app/(verificacao)/incidencia/sparkline-edicoes.tsx` | **NEW** | RSC | mini-barras CSS por edição |
| 8 | `src/app/(verificacao)/layout.tsx` | EDIT | RSC | adicionar nav (Dashboard \| Incidência) |
| 9 | `src/app/(verificacao)/dashboard/page.tsx` | EDIT (opcional) | RSC | card-link de descoberta → `/incidencia` |

Imports **sempre absolutos** (`@/...`, alias confirmado em `tsconfig.json` → `@/* → ./src/*`).

### 1.1 Decisão de rota — página dedicada (não seção do dashboard)

**Decisão:** página nova `/incidencia` + nav no layout `(verificacao)`.

**Justificativa (trade-offs):**
- **Separação de domínio.** O dashboard é **diagnóstico do usuário** (`diag_por_no` filtrado por `user_id`: pontos fracos, evolução). Incidência/Tendência é **fato do corpus** (views **sem `user_id`**: o que a prova cobre e a estabilidade disso). Misturar fato-do-corpus dentro do dashboard pessoal dilui os dois e arrisca dar a impressão de que o dado de incidência é "sobre você".
- **A home já promete isso.** `src/app/page.tsx` descreve Verificação como *"pontos fracos, tendência, alvos"* — "tendência" pertence a este ambiente; uma página própria dá espaço sem sobrecarregar o dashboard (que já é denso).
- **Descoberta.** O layout `(verificacao)` hoje **não tem nav** (diferente do `(estudo)`). Adicionar uma nav mínima (espelhando o `(estudo)/layout.tsx`) é aditivo, baixo risco, e melhora o ambiente como um todo. Sem isso a página fica órfã.
- **Alternativa rejeitada (seção no dashboard):** acopla corpus+usuário, alonga uma página já cheia, e não resolve a descoberta de forma limpa.

---

## 2. Data-fetching (qual view, server-side, a query)

Padrão **idêntico ao `dashboard/page.tsx`**: RSC, `createClient` de `@/lib/supabase/server`, auth-gate com `redirect("/login")`. Fetch inline na page (o ambiente `(verificacao)` não usa `_actions/`).

```ts
// src/app/(verificacao)/incidencia/page.tsx  (trecho de fetch)
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { montarRanking } from "@/lib/incidencia/tendencia";

const TOP_GRAFICO = 15;   // headline (recharts)
const TOP_TABELA  = 40;   // tabela detalhada (de 158 subtemas cobrados)

export default async function IncidenciaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // (a) Ranking cumulativo — 1 linha por subtema (~158 linhas)
  const { data: incid } = await supabase
    .from("v_incidencia_subtema")
    .select("subtema_id, subtema_nome, materia_id, materia_nome, n_questoes, n_disponiveis")
    .order("n_questoes", { ascending: false });

  // (b) Série temporal — 1 linha por (subtema × edição), SÓ células não-zero (~551 linhas)
  const { data: tend } = await supabase
    .from("v_tendencia_subtema")
    .select("subtema_id, exame_numero, ano, n_questoes")
    .order("exame_numero", { ascending: true });

  // Densifica zeros + monta o view-model (pure lib — §3)
  const { edicoes, maxSerie, linhas } = montarRanking(incid ?? [], tend ?? []);
  // ... render (§4)
}
```

**Notas de fetch:**
- **Sem `.eq("user_id", …)`** — as views são fato do corpus, não têm `user_id`. (Auth-gate ainda existe, porque o ambiente é autenticado.)
- **Volume:** 158 + 551 linhas, bem abaixo do teto default do PostgREST (1000/req). Sem paginação. Sem `.limit()`.
- **`v_tendencia_subtema` só emite células não-zero** (INNER JOIN). Par `(subtema, edição)` ausente = **0 questões** — sinal real, não missing. A densificação dos zeros é **obrigatória** (§3) — é o ponto nº1 onde dá pra errar.
- **Eixo de edições é derivado do dado**, não hardcoded: `DISTINCT exame_numero` ordenado (hoje `38,39,41,42,43,44,45,46`; 37 e 40 não foram ingeridos). Robusto a novas edições.

---

## 3. Pure lib — densificação + ranking (`src/lib/incidencia/tendencia.ts`)

Segue a convenção de `src/lib/diagnostico/*` (lógica pura, testável). **Esta é a peça correção-crítica** (escape-hatch via teste, §8).

```ts
// src/lib/incidencia/tendencia.ts
// Pure: densifica a série esparsa de v_tendencia_subtema e monta o ranking.
// Fato do corpus — NENHUM juízo de tendência/previsão aqui (ver docs/analysis).

import type { IncidenciaRow, TendenciaRow, SubtemaTendencia } from "@/lib/types/domain";

/** Eixo temporal = edições realmente presentes no corpus, ordenadas asc. */
export function eixoEdicoes(tend: TendenciaRow[]): number[] {
  return [...new Set(tend.map((t) => t.exame_numero ?? 0))]
    .filter((e) => e > 0)
    .sort((a, b) => a - b);
}

/** Reintroduz os ZEROS: para cada edição do eixo, usa a contagem ou 0. */
export function densificarSerie(porEdicao: Map<number, number>, edicoes: number[]): number[] {
  return edicoes.map((ed) => porEdicao.get(ed) ?? 0);
}

export interface RankingTendencia {
  edicoes: number[];          // eixo x (edições presentes)
  maxSerie: number;           // máx GLOBAL de células (normaliza sparklines p/ comparabilidade)
  linhas: SubtemaTendencia[]; // ordenadas por incidência desc
}

export function montarRanking(incid: IncidenciaRow[], tend: TendenciaRow[]): RankingTendencia {
  const edicoes = eixoEdicoes(tend);

  // Agrupa série por subtema → Map<edicao, n>
  const porSubtema = new Map<string, Map<number, number>>();
  for (const t of tend) {
    if (!t.subtema_id || !t.exame_numero) continue;
    const m = porSubtema.get(t.subtema_id) ?? new Map<number, number>();
    m.set(t.exame_numero, t.n_questoes ?? 0);
    porSubtema.set(t.subtema_id, m);
  }

  const linhas: SubtemaTendencia[] = incid
    .filter((i) => i.subtema_id)
    .map((i) => ({
      subtemaId: i.subtema_id as string,
      subtemaNome: i.subtema_nome ?? "—",
      materiaNome: i.materia_nome ?? "—",
      incidencia: i.n_questoes ?? 0,
      disponiveis: i.n_disponiveis ?? 0,
      serie: densificarSerie(porSubtema.get(i.subtema_id as string) ?? new Map(), edicoes),
    }))
    .sort((a, b) => b.incidencia - a.incidencia);

  // máx GLOBAL (corpus atual = 3). Normaliza TODAS as sparklines pela mesma escala →
  // contagem 1 tem a mesma altura em qualquer linha → o olho enxerga a PLANURA (anti-chute).
  const maxSerie = Math.max(1, ...linhas.flatMap((l) => l.serie));

  return { edicoes, maxSerie, linhas };
}
```

**Por que `maxSerie` GLOBAL (e não por-linha):** normalizar cada sparkline ao seu próprio pico exageraria micro-ruído e sugeriria "movimento". Escala global (máx do corpus = 3) deixa toda série visualmente baixa e plana — que é a verdade estatística. **Não trocar por normalização por-linha.**

---

## 4. UI — breakdown de componentes

Layout da página (max-w-6xl, espelha o dashboard). Ordem vertical:

```
┌ BannerHonestidade (RSC) ───────────────────────────────────┐  ← topo, não-dismissível
├ 4 cards de resumo (RSC, grid) ─────────────────────────────┤
├ "Top 15 por incidência"  → GraficoIncidencia (client) ─────┤  ← headline recharts
├ "Ranking por subtema" → tabela (RSC) c/ SparklineEdicoes ──┤  ← lista ranqueada + planura
└ legenda/rodapé honesto ────────────────────────────────────┘
```

### 4.1 `BannerHonestidade` (RSC) — o coração do anti-chute
Box informativo neutro (estilo `bg-amber-50 border-amber-200`, **não** vermelho de alarme). Recebe `{ edMin, edMax }` para citar a janela. Texto (PT-BR), fixo:

> **Incidência estável — sem rotação detectável.**
> A incidência por subtema é **estável** na janela analisada (edições **{edMin}–{edMax}**). Testamos a hipótese de a FGV "rotacionar" subtemas (um esfria, outro esquenta) com um **teste de permutação (5000 reamostragens)** e ela **não se sustenta**: o movimento observado é **igual ou menor que o do acaso**.
> Este painel é **descritivo** — mostra o que **já caiu**, não prevê o que **vai cair**. Use a incidência para priorizar **volume histórico**; **não existe subtema "na vez"**.
> <span class="text-xs">Base: análise `docs/analysis/tendencia-subtema-findings.md` (ed38–46, 640 questões).</span>

### 4.2 Cards de resumo (RSC) — grid `grid-cols-2 sm:grid-cols-4 gap-4`, estilo do dashboard
1. **Subtemas cobrados** = `linhas.length` (≈158)
2. **Questões na janela** = `Σ incidencia` (≈640)
3. **Edições** = `edicoes.length` (≈8)
4. **Estabilidade**: glyph **→** + label "Estável" (neutro, cinza — **não** verde/vermelho). Reusa o visual do card de tendência do dashboard, mas afirmando a estabilidade do **corpus**.

### 4.3 `GraficoIncidencia` (`"use client"`) — espelha `grafico-materias.tsx`
- `recharts` (^3.1.0, já no projeto). `BarChart` horizontal (`layout="vertical"`), `ResponsiveContainer height={360}`.
- `data` = top-15 `linhas` → `{ nome (truncado 22), nomeCompleto, materiaNome, incidencia, disponiveis }`.
- `XAxis type="number"` (domínio `[0, max incidencia]`), `YAxis type="category" dataKey="nome" width={170}`.
- **Cor única neutra** (ex.: `#6366f1` indigo ou `#64748b` slate) — **NÃO** usar a paleta verde/âmbar/vermelho de `getBarColor` do `grafico-materias`. Aquela paleta significa **desempenho**; aqui é **volume do corpus**, colorir por valor implicaria juízo. Um `<Bar fill="#6366f1">` só.
- `Tooltip`: `${incidencia} questões (${disponiveis} respondíveis) — ${materiaNome}`.
- Card wrapper: `bg-white rounded-xl border border-gray-200 p-4` (idêntico ao dashboard).

### 4.4 Tabela ranqueada (RSC, inline na page) — top-40
Estilo de tabela do `progresso/page.tsx` (`bg-gray-50` no head, zebra `bg-gray-50/50`). Colunas:

| Col | Conteúdo | Notas |
|-----|----------|-------|
| **#** | rank (1..40) | `tabular-nums text-gray-400` |
| **Subtema** | `subtemaNome` + linha fina `materiaNome ›` | padrão do `cronograma-view` (materia em `text-xs text-gray-400`) |
| **Incidência** | **barra CSS horizontal** (largura ∝ `incidencia/maxIncid`, cor `bg-slate-300`) + nº | esta É a visualização do ranking in-table |
| **Por edição** | `<SparklineEdicoes serie edicoes max={maxSerie} />` | a planura, com zeros densificados |
| **Respondíveis** | `disponiveis` | honestidade do loop (treino vazio?) |
| **Treinar** | se `disponiveis > 0`: `<Link href={\`/treino?subtema=${subtemaId}\`}>` | **reusa** o deep-link do `cronograma-view.tsx` (fecha o loop incidência→treino) |

Nota de rodapé: *"Mostrando os 40 de maior incidência de {linhas.length} subtemas cobrados. Variação por edição está dentro do ruído estatístico (ver banner)."*

### 4.5 `SparklineEdicoes` (RSC, mini-barras CSS) — **sem `"use client"`, sem animação**

```tsx
// src/app/(verificacao)/incidencia/sparkline-edicoes.tsx
export function SparklineEdicoes({
  serie, edicoes, max,
}: { serie: number[]; edicoes: number[]; max: number }) {
  return (
    <div
      className="flex items-end gap-0.5 h-9 border-b border-gray-100"
      role="img"
      aria-label={`Questões por edição: ${serie.join(", ")}`}
    >
      {serie.map((v, i) => (
        <div
          key={edicoes[i]}
          title={`Ed. ${edicoes[i]}: ${v} ${v === 1 ? "questão" : "questões"}`}
          className="w-2 bg-slate-300 rounded-t-sm shrink-0"
          style={{ height: max > 0 ? `${(v / max) * 100}%` : "0%" }}
        />
      ))}
    </div>
  );
}
```

- **Cor única `bg-slate-300`** para todas as barras — **nunca** colorir por direção (subiu/desceu). Isso é guardrail anti-chute (§7).
- **`max` é o `maxSerie` GLOBAL** → barras comparáveis entre linhas → planura visível.
- Célula 0 → barra de altura 0 (slot vazio sobre a baseline `border-b`), que é a leitura honesta da esparsidade.
- Sem `transition`/keyframes (alturas estáticas) — respeita "no CSS-animation hacks".
- Por que CSS e não recharts por linha: renderizar ~40 `ResponsiveContainer` (um por linha) é pesado (40 resize observers) e força `"use client"` em cada um. Para sparkline de 8 pontos, barras CSS são RSC, leves e mais honestas (barras discretas > linha contínua, que sugeriria tendência). **Decisão A/B/C na §9.**

---

## 5. Nav / linkagem

### 5.1 `src/app/(verificacao)/layout.tsx` — EDIT (adicionar nav, espelhando `(estudo)/layout.tsx`)

Hoje o layout só tem um `<header>` com um `<span>`. Trocar por header com nav (mesmas classes do estudo):

```tsx
import Link from "next/link";

const NAV_LINKS = [
  { href: "/dashboard",  label: "Dashboard" },
  { href: "/incidencia", label: "Incidência" },
];

export default function VerificacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-3">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="font-semibold text-gray-900 shrink-0">Ambiente de Verificação</span>
          <nav className="flex items-center gap-1 flex-wrap">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href}
                className="px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

### 5.2 (Opcional, recomendado) Card-link no dashboard
Em `dashboard/page.tsx`, ao lado do bloco "Última sessão", um card discreto: *"Incidência & tendência por subtema →"* apontando para `/incidencia`. Aumenta descoberta; baixo custo. Mesmo estilo `bg-blue-50 border-blue-200`.

---

## 6. Tipos novos

### 6.1 `db.types.ts` — **REGENERAR (Step 0, pré-requisito)**

`v_incidencia_subtema` **já está** tipada (linha ~965). `v_tendencia_subtema` **NÃO está** (a migration `20260628201154` foi aplicada mas os tipos não foram regenerados). O client tipado `createClient<Database>` vai **falhar no TS** em `.from("v_tendencia_subtema")` enquanto a view não estiver no `Database`.

**Comando (local-first — o stack local Docker tem a migration aplicada; ver memória do projeto):**
```bash
supabase gen types typescript --local > src/lib/types/db.types.ts
```
> **NÃO editar `db.types.ts` à mão** (regra do projeto + comentário das migrations). Se a regeneração estiver bloqueada no ambiente, escape-hatch documentado: fazer **essa única** query via client sem genéricos (cast local), e abrir tarefa para regenerar. Preferir sempre a regeneração.

**`Row` esperada (para @dev verificar o output da regeneração):**
```ts
v_tendencia_subtema: {
  Row: {
    ano: number | null
    exame_numero: number | null
    materia_id: string | null
    materia_nome: string | null
    n_questoes: number | null
    subtema_id: string | null
    subtema_nome: string | null
  }
  Relationships: [ /* auto: FKs p/ materias e subtemas */ ]
}
```

### 6.2 `src/lib/types/domain.ts` — APPEND (tipos de domínio camelCase)

```ts
// --- Incidência & Tendência por subtema (painel descritivo /incidencia) ---

/** Linha crua de v_incidencia_subtema (cumulativa, fato do corpus). */
export interface IncidenciaRow {
  subtema_id: string | null;
  subtema_nome: string | null;
  materia_id: string | null;
  materia_nome: string | null;
  n_questoes: number | null;
  n_disponiveis: number | null;
}

/** Linha crua de v_tendencia_subtema (1 por subtema×edição, só células não-zero). */
export interface TendenciaRow {
  subtema_id: string | null;
  exame_numero: number | null;
  ano: number | null;
  n_questoes: number | null;
}

/** View-model de uma linha do ranking, com série temporal JÁ densificada. */
export interface SubtemaTendencia {
  subtemaId: string;
  subtemaNome: string;
  materiaNome: string;
  incidencia: number;   // n_questoes cumulativo (a métrica do ranking)
  disponiveis: number;  // n_disponiveis (respondíveis agora)
  serie: number[];      // alinhada a `edicoes`, com zeros reintroduzidos
}
```
> As `*Row` podem ser derivadas de `Database["public"]["Views"][…]["Row"]` após a regeneração; defini-las explícitas aqui mantém a pure lib desacoplada do tipo gerado (e testável sem o DB), padrão já usado no `progresso/page.tsx`.

---

## 7. Guardrails ANTI-CHUTE (checklist obrigatório de revisão)

Derivados de `tendencia-subtema-findings.md` §4–§5. @dev e @qa devem bater item a item:

- [ ] **Sem rótulo de direção por subtema.** Nada de "em alta/em queda/subindo/RISING/FALLING" por linha. (§5: são ruído; o mais extremo |slope|=0.19 fica abaixo do máx do acaso 0.36.)
- [ ] **Sparkline monocromática** (`slate-300`). Nenhuma barra colorida por subir/descer. Nenhuma seta ▲▼ por linha.
- [ ] **Sem linguagem preditiva** em lugar nenhum: proibido "vai cair", "próxima edição", "tende a", "previsão", "na vez", "devido".
- [ ] **Zeros densificados.** A série mostra os 0s reais (senão parece sempre ativa e enviesa pra cima). Teste cobre isso (§8).
- [ ] **Normalização global** das sparklines (mesma escala) — para a planura aparecer, não o ruído.
- [ ] **Ranking é "o que já caiu"** (incidência histórica), nunca "o que vai cair". Título e rodapé deixam isso explícito.
- [ ] **Banner não-dismissível, acima dos dados.** A honestidade vem antes do número.
- [ ] **Card de estabilidade neutro** (cinza →), não verde de "bom" nem vermelho de "ruim".

---

## 8. Test plan (escape-hatch)

> Contexto honesto: o projeto tem `vitest ^2.1.8` como devDep, mas **não há script `test` nem config nem testes existentes**. Os gates duros que **já existem** são `npm run lint` e `npm run typecheck` — ambos **devem passar**. O teste abaixo é **recomendado** (a densificação é a única peça de risco real) e barato de habilitar.

**Habilitar vitest (1 linha em `package.json scripts`):** `"test": "vitest run"`.

**`src/lib/incidencia/tendencia.test.ts` — casos mínimos:**
1. `eixoEdicoes` retorna edições distintas, ordenadas, sem zeros/nulos (ex.: entrada com `38,41,38,46` → `[38,41,46]`).
2. `densificarSerie` **reintroduz zeros**: subtema presente só em ed39 e ed45, eixo `[38,39,41,45,46]` → `[0,1,0,1,0]`. (guardrail nº4)
3. `montarRanking` ordena por `incidencia` desc e alinha cada `serie` ao `edicoes` (comprimento = `edicoes.length` para toda linha).
4. `maxSerie` = máximo global das células (não por-linha).
5. Subtema em `incid` mas ausente de `tend` → `serie` toda zero, comprimento correto.

**Validação observacional (manual, RSC):** rodar `npm run dev`, abrir `/incidencia`, conferir que (a) sparklines têm `edicoes.length` barras, (b) somatório dos cards bate (~640 questões, ~158 subtemas, 8 edições), (c) nenhuma cor direcional.

---

## 9. Decisões de arquitetura (trade-offs)

**D1 — Rota:** página dedicada `/incidencia` + nav no layout. Ver §1.1. (Alt. rejeitada: seção no dashboard — acopla corpus+usuário.)

**D2 — Sparkline (A/B/C):**
- **(A) recharts por linha** — mesma lib, mas ~40 `ResponsiveContainer`/observers, força `"use client"` em massa, exagero p/ 8 pontos. **Rejeitado.**
- **(B) mini-barras CSS** — RSC puro, leve em qualquer nº de linhas, sem animação, barras discretas (mais honestas que linha p/ contagens), nativo `title` p/ acessibilidade. **ESCOLHIDO.**
- **(C) SVG polyline à mão** — leve e RSC, mas linha contínua sugere tendência/continuidade (levemente anti-chute) e mais código que (B). **Rejeitado.**
- Observação: sparkline nunca foi feito com recharts neste codebase (recharts só p/ 1 gráfico grande por página). Usar CSS aqui **não** desvia do padrão.

**D3 — recharts no headline (top-15):** mantido para honrar a lib da casa e dar um "ranking" visual forte (espelha `grafico-materias.tsx`). Redundância leve com a tabela é aceitável (gráfico = headline top-15; tabela = lista ranqueada + detalhe por edição + ação).

**D4 — Normalização global da sparkline:** crítica para a mensagem (planura). Não trocar por per-linha.

**D5 — Pure lib separada (`lib/incidencia/`):** segue `lib/diagnostico/*`, dá seam testável p/ a densificação (a parte de risco), mantém a page fina.

---

## 10. Não-objetivos / fronteiras

- **Nenhuma mudança de schema/migration.** As 2 views já existem e estão aplicadas.
- **Nenhum peso de tendência no planner.** O findings §7 recomenda **não** introduzir peso de rotação; este painel é só exibição. Não tocar `lib/planner/*`.
- **Segurança:** views são aggregate-safe, sem `user_id`, sem `gabarito`/`enunciado`. Nenhuma fronteira de gabarito envolvida. **Pre-flight (baixo risco):** confirmar que o role `authenticated` tem `SELECT` nas 2 views (são `security_invoker=on`; `subtemas/materias/questoes/exames` precisam ser legíveis — já são, pois o app lê o corpus). Se um `SELECT` retornar vazio com erro de permissão, escalar a @data-engineer (não contornar com service-role no client).
- **Backward-compat:** 100% aditivo. Único arquivo editado com comportamento atual é `(verificacao)/layout.tsx` (ganha nav; não remove nada) e, opcional, o dashboard (ganha um card).

---

## 11. Pre-flight checklist (@dev)

- [ ] Step 0: `supabase gen types typescript --local > src/lib/types/db.types.ts` e confirmar `v_tendencia_subtema` na seção `Views` (§6.1).
- [ ] `domain.ts` recebe os 3 tipos (§6.2).
- [ ] `lib/incidencia/tendencia.ts` + teste (§3, §8).
- [ ] Page + 3 componentes (`banner-honestidade`, `grafico-incidencia`, `sparkline-edicoes`) (§4).
- [ ] Nav no layout `(verificacao)` (§5.1).
- [ ] Imports absolutos `@/...` em tudo.
- [ ] Guardrails anti-chute (§7) — todos marcados.
- [ ] `npm run typecheck` e `npm run lint` passam.
- [ ] Smoke manual em `/incidencia` (§8).
```
