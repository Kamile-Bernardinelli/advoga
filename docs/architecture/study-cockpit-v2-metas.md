# Advoga — Cockpit de Estudo v2: LOOP DE ADERÊNCIA (metas + timer + saldo)

> **Autor:** Aria (@architect) · **Data:** 2026-06-26 · **Status:** v1.0 (design — NÃO implementado)
> **Modelo:** Opus (decisão de arquitetura) · **Owner:** Marcos · **Usuária:** Kamile
> **Restrição-mãe:** prova OAB 1ª fase **06/09/2026** (~**72 dias** em 2026-06-26).
> **Pré-requisitos lidos:** `docs/architecture/study-cockpit.md`, `docs/architecture/SCHEMA.md`,
> migration aplicada `20260626120000_study_cockpit.sql`, `src/lib/planner/{cronograma,planner,config}.ts`,
> route group `src/app/(estudo)/*` (plano, cronograma, registro, _actions), `src/lib/types/domain.ts`.
> **Natureza:** **ADITIVO**. Nenhuma tabela, view, enum, policy, função ou arquivo existente é
> alterado de forma destrutiva. O pilar de questões e o Cockpit v1 (sensor + cronograma) continuam intactos.
> **Estende:** `study-cockpit.md` (v1). Este doc é o v2 — não o substitui.

---

## 0. O que muda e por quê (1 parágrafo)

O Cockpit v1 já entrega o **sensor** (`estudo_sessoes`) e o **roteiro** (`cronograma_blocos`,
conteúdo+questões priorizados). Falta fechar o **loop de aderência**: a Kamile precisa de uma
**meta de tempo** (quanto estudar por dia/mês), de um **timer** que registra automaticamente, e de
um **saldo** (estudou × meta) que acumula por dia/semana/mês — para **compensar** dias perdidos e
**fechar a meta mensal**. E o "plano do dia" precisa virar **um só lugar** com conteúdo + questões
(hoje há dois: `/plano`, só questões, do Drop 1; e `/cronograma`, completo). Este v2 adiciona:
(1) **metas flexíveis** (base diária + override por dia + meta mensal); (2) **timer** start/stop
amarrável a um bloco; (3) **saldo/compensação** (views + matemática) com re-plan do cronograma; e
(4) a **unificação do plano-do-dia**. Tudo subordinado à restrição-mãe: isto faz a Kamile **manter
ritmo e não perder horas** rumo a 06/09 — alta prioridade, baixo custo (a fundação já existe).

---

## 1. Princípios desta extensão (não negociáveis)

1. **100% aditivo — zero quebra.** Nova migration só com `CREATE TABLE/FUNCTION/VIEW/POLICY/INDEX`.
   Nenhum `ALTER`/`DROP` em objeto existente. O timer **reusa** `registrarEstudo` (já aceita
   `inicio`/`fim`). A mudança no gerador é um **swap cirúrgico** (escalar → lookup), não um rewrite.
2. **Construir EM CIMA do fix em andamento.** O `cronograma.ts` está sendo corrigido AGORA
   (ordenação por prioridade + conteúdo-antes-de-questões). A mudança de "meta-por-dia" entra
   **depois** desse commit e é um diff mínimo dentro de `earliestFit`/`orcamentoTotal` — não toca o
   sequenciamento das duas fases. Ver §4.
3. **Espelhar os padrões da casa.** Enums via `DO`-block guard; `user_id → auth.users` + RLS
   `auth.uid()=user_id` com `ENABLE`/`FORCE` e policies `{tabela}_{select|insert|update|delete}_own`;
   `created_at/updated_at` + trigger `trg_set_updated_at` reusando `public.set_updated_at()`; views
   `security_invoker=on`; gate/limiar como **função SQL single-source-of-truth** (espelha
   `diag_gate_minimo()` / `esforco_gate_tempo_min()`).
4. **Fato em SQL, recomendação no app.** As views entregam **fatos** (real, meta, saldo, acumulado).
   A **recomendação** ("você está atrasada", "estude X min/dia para fechar a meta") é calculada no app
   (`src/lib/metas/saldo.ts`, puro e testável) — mesma separação do §4 anti-chute e do
   `weakness-score.ts`. Nunca um veredito embutido no dado.
5. **Uma fonte de verdade para "quanto por dia".** As tabelas de meta alimentam **ao mesmo tempo**
   (a) o cálculo de saldo e (b) o orçamento diário do gerador de cronograma. `meta_do_dia(user, data)`
   é a função canônica; o gerador usa a **mesma fórmula** (documentada como espelho, como
   `gateTempoMin` espelha `esforco_gate_tempo_min()`).
6. **Capability preservation (architect-first).** A unificação do plano-do-dia **não apaga** o planner
   de questões (`gerarPlano`/`plano_diario`/`ExplicacaoPlano`): ele é **realocado** como o detalhe
   "quais questões fazer" dentro do bloco de questões. Nada de capacidade é perdido — só reposicionado.

---

## 2. Schema novo (migration aditiva)

- **Arquivo:** `supabase/migrations/20260626130000_metas_aderencia.sql`
  (posterior a `20260626120000_study_cockpit.sql`; mesmo padrão de sufixo do `20260621130000`).
- **Idempotente:** `IF NOT EXISTS` / `DO`-block guards / `CREATE OR REPLACE`.
- **Aplicar de uma vez** (2 tabelas + 1 função + 2 views têm dependências entre si).

### 2.1 Tabelas

| Tabela | Papel | Colunas-chave | RLS |
|--------|-------|---------------|-----|
| `metas_estudo` | **config singleton por usuária** | `user_id` **UNIQUE**, `meta_base_diaria_min`, `meta_mensal_min?`, `dias_estudo smallint[]`, `timezone` | `auth.uid()=user_id` |
| `metas_diarias` | **override por dia** | `user_id`, `data`, `minutos_meta` (0 = folga), `nota?`, **UNIQUE(user_id,data)** | `auth.uid()=user_id` |

**Decisões de modelagem (e por quê):**

- **`metas_estudo` é singleton** (`UNIQUE(user_id)`) — single-user, uma config. Multi-user no futuro:
  zero mudança de schema (D-01).
- **`dias_estudo smallint[]` (default `{0..6}`) mora aqui, não só no gerador.** É a **mesma** lista de
  dias-de-estudo que o `cronograma.ts` já aceita (`diasEstudo?: number[]`). Centralizá-la resolve **de
  uma vez** a pergunta "quais dias contam?" para o **saldo** E para o **cronograma**.
  `EXTRACT(DOW)` do Postgres e `Date.getDay()` do JS usam a **mesma convenção** (0=Domingo..6=Sábado)
  → semântica idêntica nos dois lados. `[AUTO-DECISION]` incluir `dias_estudo` em `metas_estudo`
  (owner pediu base/mensal/override; adiciono `dias_estudo` porque sem ele o saldo geraria déficit
  fantasma em fins de semana e o cronograma precisaria de uma 2ª fonte — unificar é a opção mais limpa).
- **`timezone` (default `America/Sao_Paulo`) é correção, não enfeite.** O "dia" de uma sessão é
  `date(ts AT TIME ZONE timezone)`. Sem isso, uma sessão às 22h BRT (01h UTC do dia seguinte) cairia
  no **dia errado** e o saldo diário ficaria torto. Ver flag de segurança/corretude §8 e M-7.
- **`minutos_meta = 0` é válido** (folga explícita num dia que normalmente seria de estudo). `CHECK >= 0`.
- **`metas_diarias` é override total** (não delta): o valor do dia, quando existe, **vence** a base.

### 2.2 Função canônica — `meta_do_dia(user, data)`

Single source of truth do "quanto a meta daquele dia" (override → base-se-dia-de-estudo → 0).
Espelha o padrão `diag_gate_minimo()`/`esforco_gate_tempo_min()`. `STABLE` (lê tabelas),
`SET search_path = ''`, fully-qualified, `SECURITY INVOKER` (default) → RLS da usuária aplica.

### 2.3 Views de saldo

| View | Grão | Entrega |
|------|------|---------|
| `v_saldo_diario` | dia | `meta_min`, `real_min` (Σ `duracao_min` do dia, **timezone-aware**), `saldo_dia = real − meta`, **`saldo_acum_semana`**, **`saldo_acum_mes`**, `saldo_acum_total` (janelas) |
| `v_saldo_mensal` | mês | `meta_mensal_min`, `real_min` (Σ do mês), `saldo_mes`, `pct_meta` |

- **Janela de dias:** `v_saldo_diario` enumera de `MIN(dia da 1ª sessão)` até **hoje** (no fuso da
  usuária). Ancorar na 1ª sessão evita **déficit fantasma** antes de ela começar a usar o app. Dias
  sem estudo **dentro** do período ativo, em dia-de-estudo, contam como déficit real (correto).
- **`saldo_acum_mes` é o número da compensação:** reset por mês (`PARTITION BY date_trunc('month')`).
  Negativo = déficit a recuperar antes do fim do mês. `saldo_acum_semana` cobre a visão semanal pedida.
- **`v_saldo_mensal` é o contrato:** `real_mes × meta_mensal_min`. Pode divergir de `Σ metas diárias`
  — e tudo bem: **diário = disciplina de ritmo**; **mensal = contrato**. São duas lentes, ambas pedidas.

### 2.4 DDL exato (entregável para o @data-engineer — copiar/colar)

```sql
-- =============================================================================
-- Advoga — Cockpit v2: LOOP DE ADERÊNCIA (metas + saldo) — SCHEMA ADITIVO
-- Migration: 20260626130000_metas_aderencia.sql
-- Author: Dara (@data-engineer) · Design: Aria (@architect)
-- Depends on: 20260621120000..120003 (tabelas/RLS/diag), 20260626120000 (estudo_sessoes)
-- =============================================================================
-- PURPOSE
--   metas_estudo   — config singleton: meta base diária, meta mensal, dias de estudo, timezone
--   metas_diarias  — override de meta por dia específico (0 = folga)
--   meta_do_dia()  — função canônica: override -> base(se dia de estudo) -> 0
--   v_saldo_diario — real × meta por dia + acumulado (semana/mês/total)  [timezone-aware]
--   v_saldo_mensal — real × meta mensal por mês (o "contrato")
--
-- ADITIVO: nenhum ALTER/DROP em objeto existente. Seguro re-rodar (idempotente).
-- =============================================================================

BEGIN;

-- set_updated_at() e pgcrypto já existem (init_schema) — reutilizados.

-- -----------------------------------------------------------------------------
-- 1. METAS_ESTUDO — config singleton por usuária
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metas_estudo (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_base_diaria_min integer NOT NULL DEFAULT 180
                         CHECK (meta_base_diaria_min >= 0 AND meta_base_diaria_min <= 1440),
  meta_mensal_min      integer
                         CHECK (meta_mensal_min IS NULL
                                OR (meta_mensal_min >= 0 AND meta_mensal_min <= 44640)), -- 31*1440
  dias_estudo          smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  timezone             text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_estudo_user_uniq UNIQUE (user_id),
  CONSTRAINT metas_estudo_dias_validos
    CHECK (dias_estudo <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
);
COMMENT ON TABLE public.metas_estudo IS
  'Config singleton de metas de tempo da usuária. dias_estudo (0=Dom..6=Sab, igual JS getDay) e '
  'timezone alimentam TANTO o saldo QUANTO o orçamento diário do gerador de cronograma. RLS auth.uid()=user_id.';

-- -----------------------------------------------------------------------------
-- 2. METAS_DIARIAS — override de meta por dia (0 = folga). Vence a base.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metas_diarias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data         date NOT NULL,
  minutos_meta integer NOT NULL CHECK (minutos_meta >= 0 AND minutos_meta <= 1440),
  nota         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_diarias_user_data_uniq UNIQUE (user_id, data)
);
COMMENT ON TABLE public.metas_diarias IS
  'Override de meta diária por data (substitui a base; 0 = folga). Base da compensação. RLS auth.uid()=user_id.';

-- -----------------------------------------------------------------------------
-- 3. ÍNDICES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_metas_estudo_user  ON public.metas_estudo (user_id);
CREATE INDEX IF NOT EXISTS idx_metas_diarias_user_data ON public.metas_diarias (user_id, data);

-- -----------------------------------------------------------------------------
-- 4. TRIGGERS updated_at (reusa public.set_updated_at())
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; tbls text[] := ARRAY['metas_estudo','metas_diarias'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5. RLS single-user — espelha 20260626120000 (user_id direto → sem trigger de sync)
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; tbls text[] := ARRAY['metas_estudo','metas_diarias'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE  ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                      USING (auth.uid() = user_id);', t||'_select_own', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
                      WITH CHECK (auth.uid() = user_id);', t||'_insert_own', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
                      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);',
                   t||'_update_own', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_delete_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
                      USING (auth.uid() = user_id);', t||'_delete_own', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 6. meta_do_dia() — SINGLE SOURCE OF TRUTH: override -> base(se dia de estudo) -> 0
--    EXTRACT(DOW) = 0..6 (Dom..Sab), mesma convenção do JS Date.getDay().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.meta_do_dia(p_user_id uuid, p_data date)
RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(
    (SELECT md.minutos_meta
       FROM public.metas_diarias md
       WHERE md.user_id = p_user_id AND md.data = p_data),
    (SELECT CASE
              WHEN EXTRACT(DOW FROM p_data)::smallint = ANY(me.dias_estudo)
              THEN me.meta_base_diaria_min ELSE 0 END
       FROM public.metas_estudo me
       WHERE me.user_id = p_user_id),
    0
  );
$$;
COMMENT ON FUNCTION public.meta_do_dia(uuid, date) IS
  'Meta de minutos de um dia: override (metas_diarias) -> base (metas_estudo, se dia de estudo) -> 0. '
  'Single source of truth — o gerador de cronograma usa a MESMA fórmula em TS.';

-- -----------------------------------------------------------------------------
-- 7. VIEW v_saldo_diario — real × meta por dia + acumulado (timezone-aware)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_saldo_diario
WITH (security_invoker=on) AS
WITH cfg AS (
  SELECT user_id, timezone FROM public.metas_estudo
),
bounds AS (
  SELECT c.user_id, c.timezone,
         COALESCE(MIN((es.ts AT TIME ZONE c.timezone)::date),
                  (now() AT TIME ZONE c.timezone)::date)      AS dia_ini,
         (now() AT TIME ZONE c.timezone)::date                AS dia_fim
  FROM cfg c
  LEFT JOIN public.estudo_sessoes es ON es.user_id = c.user_id
  GROUP BY c.user_id, c.timezone
),
dias AS (
  SELECT b.user_id, gs::date AS dia,
         public.meta_do_dia(b.user_id, gs::date) AS meta_min
  FROM bounds b
  CROSS JOIN LATERAL generate_series(b.dia_ini, b.dia_fim, interval '1 day') gs
),
real AS (
  SELECT es.user_id, (es.ts AT TIME ZONE c.timezone)::date AS dia,
         SUM(es.duracao_min)::int AS real_min, COUNT(*)::int AS n_sessoes
  FROM public.estudo_sessoes es
  JOIN cfg c ON c.user_id = es.user_id
  GROUP BY es.user_id, (es.ts AT TIME ZONE c.timezone)::date
),
base AS (
  SELECT d.user_id, d.dia, d.meta_min,
         COALESCE(r.real_min, 0)  AS real_min,
         COALESCE(r.n_sessoes, 0) AS n_sessoes
  FROM dias d
  LEFT JOIN real r ON r.user_id = d.user_id AND r.dia = d.dia
)
SELECT
  user_id, dia, meta_min, real_min, n_sessoes,
  (real_min - meta_min)                                                  AS saldo_dia,
  SUM(real_min - meta_min) OVER (
    PARTITION BY user_id, date_trunc('week',  dia) ORDER BY dia)::int     AS saldo_acum_semana,
  SUM(real_min - meta_min) OVER (
    PARTITION BY user_id, date_trunc('month', dia) ORDER BY dia)::int     AS saldo_acum_mes,
  SUM(real_min - meta_min) OVER (
    PARTITION BY user_id ORDER BY dia)::int                               AS saldo_acum_total
FROM base;
COMMENT ON VIEW public.v_saldo_diario IS
  'Saldo de tempo por dia (real × meta_do_dia) + acumulado semana/mes/total. Timezone-aware '
  '(date(ts AT TIME ZONE timezone)). Ancorado na 1a sessao (sem deficit fantasma). security_invoker=on.';

-- -----------------------------------------------------------------------------
-- 8. VIEW v_saldo_mensal — real × meta mensal (o "contrato")
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_saldo_mensal
WITH (security_invoker=on) AS
WITH cfg AS (
  SELECT user_id, timezone, meta_mensal_min FROM public.metas_estudo
),
mensal AS (
  SELECT es.user_id,
         date_trunc('month', (es.ts AT TIME ZONE c.timezone))::date AS mes,
         SUM(es.duracao_min)::int AS real_min, COUNT(*)::int AS n_sessoes
  FROM public.estudo_sessoes es
  JOIN cfg c ON c.user_id = es.user_id
  GROUP BY es.user_id, date_trunc('month', (es.ts AT TIME ZONE c.timezone))
)
SELECT
  m.user_id, m.mes, c.meta_mensal_min, m.real_min, m.n_sessoes,
  (m.real_min - COALESCE(c.meta_mensal_min, 0)) AS saldo_mes,
  CASE WHEN c.meta_mensal_min IS NULL OR c.meta_mensal_min = 0 THEN NULL
       ELSE round(100.0 * m.real_min / c.meta_mensal_min, 1) END AS pct_meta
FROM mensal m
JOIN cfg c ON c.user_id = m.user_id;
COMMENT ON VIEW public.v_saldo_mensal IS
  'Saldo mensal (real × meta_mensal_min). O contrato. So aparece mes com sessoes; mes corrente vazio '
  'a app trata como 0/meta. Ritmo necessario/dias restantes ficam no app (saldo.ts). security_invoker=on.';

COMMIT;

-- =============================================================================
-- PÓS-MIGRATION (processo, não DDL):
--   supabase gen types typescript --local > src/lib/types/db.types.ts
--   (regenera tipos das 2 tabelas + 2 views; NÃO editar db.types.ts à mão)
-- =============================================================================
```

---

## 3. Matemática do saldo e da compensação (mora em `src/lib/metas/saldo.ts`, PURO)

> Princípio: **fato em SQL, recomendação no app.** As views dão `real/meta/saldo/acumulado`. O app
> calcula **dias restantes**, **ritmo necessário** e a **proposta de compensação** — testável sem DB.

### 3.1 Saldo (vem das views — fato)
```
saldo_dia          = real_min − meta_do_dia(dia)
saldo_acum_semana  = Σ saldo_dia na semana corrente   (superávit > 0 / déficit < 0)
saldo_acum_mes     = Σ saldo_dia no mês corrente       ← número da COMPENSAÇÃO
real_mes / meta_mensal_min = progresso do contrato mensal
```

### 3.2 Ritmo necessário para fechar a meta mensal (recomendação — app)
```
restante_mes        = max(0, meta_mensal_min − real_mes)
dias_restantes_mes  = nº de dias-de-estudo de HOJE até min(fim_do_mês, dataProva)
                      contando dias_estudo[] e respeitando overrides (override=0 não conta)
ritmo_necessario    = ceil(restante_mes / max(1, dias_restantes_mes))   // min/dia
```
- `ritmo_necessario ≤ meta_base` → **no ritmo / adiantada**.
- `ritmo_necessario > meta_base` → **atrasada**: precisa subir o ritmo (compensar).
- `dias_restantes_mes == 0 && restante_mes > 0` → **meta mensal inatingível neste mês** (honesto).

### 3.3 Status de aderência (rótulo — app, anti-chute)
```
status = saldo_acum_mes >= 0                       → 'adiantada'   (superávit)
       | saldo_acum_mes < 0 && ritmo_necessario ≤ meta_base*1.15 → 'no_ritmo' (recuperável folgado)
       | senão                                     → 'atrasada'    (precisa compensar de verdade)
```
O rótulo é recomendação rastreável ao número (`saldo_acum_mes`, `ritmo_necessario`), nunca um veredito solto.

### 3.4 Proposta de compensação (re-distribuir o que falta — app)
```
teto_diario        = config (ex.: 1.5 × meta_base, ou hard cap de minutosTetoCompensacao)
por_dia            = min(teto_diario, ritmo_necessario)
proposta           = [{ data: d, minutos_meta: por_dia } para cada d em dias_restantes_mes]
se Σ proposta < restante_mes  → "mesmo no teto, faltam X min; reduza a meta ou aceite déficit"
```
A proposta vira **overrides** (`metas_diarias`) — Nível A: exibir; Nível B: 1 clique grava + re-plana.
Como `meta_do_dia` é a fonte única, gravar overrides **automaticamente** redimensiona os dias no
gerador de cronograma (§4) → o conteúdo restante se re-espalha pelos dias maiores. **A compensação cai
fora de graça** da arquitetura: nenhum mecanismo novo, só metas + re-geração-de-hoje (que já existe).

---

## 4. Mudança no gerador de cronograma (EM CIMA do fix em andamento)

> **Regra de ouro deste item:** entra **DEPOIS** do commit do fix de ordenação (prioridade +
> conteúdo-antes-de-questões). É um **diff cirúrgico**, **não** mexe nas duas fases de sequenciamento
> nem no round-robin. Hoje `cronograma.ts` usa um **escalar** `budgetDiario = horasPorDia*60` para
> TODO dia; a única mudança é trocar esse escalar por um **lookup por dia**.

### 4.1 Por que é trivial
O fix já entregou `earliestFit(dataMin, minutos)`, que coloca cada chunk no **primeiro dia com espaço**
testando `(usadoPorDia[d] ?? 0) + minutos <= budgetDiario`. Isso **já é** alocação dia-a-dia contra um
teto. Variar o teto por dia é só trocar a constante pela função. O `earliestFit` naturalmente **pula**
um dia pequeno e acha um maior — então metas heterogêneas (240 na segunda, 480 no sábado, 0 na folga)
funcionam **sem nova lógica**.

### 4.2 Diff de contrato (input)
```ts
export interface CronogramaInput {
  hoje: string;
  dataProva: string;
  horasPorDia: number;                       // mantido (fallback/legado — NÃO remover)
  diasEstudo?: number[];                      // já existe; passa a vir de metas_estudo.dias_estudo
  /** NOVO (opcional, aditivo): orçamento em minutos de um dia específico.
   *  Quando presente, dimensiona CADA dia por sua meta (base/override). Espelha meta_do_dia(). */
  metaPorDiaMin?: (dataISO: string) => number;
  nos: NoDiagnostico[];
  recentErros?: SubtemaBoost[];
  cfg?: Partial<CronogramaConfig>;
}
```

### 4.3 Diff de implementação (3 pontos, nada além disso)
```ts
// 1) lookup do orçamento do dia (escalar é fallback quando metaPorDiaMin ausente)
const budgetDiarioScalar = Math.max(1, Math.round(input.horasPorDia * 60));
const budgetDoDia = (data: string): number =>
  input.metaPorDiaMin ? Math.max(0, Math.round(input.metaPorDiaMin(data))) : budgetDiarioScalar;

// 2) CALENDÁRIO: incluir o dia só se houver orçamento (override=0 e folga somem de graça)
//    while (cur < prova) { const d = iso(cur);
//      if (diasEstudo.includes(cur.getDay()) && budgetDoDia(d) > 0) datas.push(d); ... }

// 3) orçamento total = soma dos orçamentos diários (não N*escalar)
const orcamentoTotalMin = Math.round(
  datas.reduce((s, d) => s + budgetDoDia(d), 0) * FATOR_UTILIZACAO
);
// blocoSize cap pelo MAIOR dia (chunk cabe no maior; earliestFit pula dias menores):
const maxBudget = Math.max(...datas.map(budgetDoDia), 5);
const blocoSize = Math.max(5, Math.min(cfg.maxBlocoMin, maxBudget));

// 4) earliestFit: trocar a comparação com o escalar por budgetDoDia(d)
//    if ((usadoPorDia.get(d) ?? 0) + minutos <= budgetDoDia(d)) return d;
```
**Nada mais muda.** Fases 1/2 (conteúdo→questões), round-robin por prioridade, revisão espaçada:
intactos. É puro, continua testável.

### 4.4 Modo re-plan / compensação
- **Re-plan = regenerar de hoje.** A action `gerarCronograma` **já** faz
  `DELETE origem='gerado' AND status='pendente' AND data_alvo >= hoje` e re-insere. Logo, regenerar
  com os **orçamentos por dia atualizados** (refletindo overrides) **re-distribui automaticamente** o
  conteúdo restante pelos dias que sobram. **Não há mecanismo novo.**
- **Compensação = re-plan com dias futuros maiores.** Nível A: a usuária define overrides (ou sobe a
  base) e regenera. Nível B (1 clique): `aplicarCompensacao()` grava overrides = `por_dia` (§3.4) nos
  dias restantes e chama `gerarCronograma`. Se nem no teto cabe tudo, o `earliestFit` descarta os chunks
  de **menor prioridade** (peso menor) — e a UI avisa quanto sobrou (anti-chute: prioridade vence,
  honesto sobre o que não cabe).

---

## 5. UX

### 5.1 Timer (start/stop) — `src/components/estudo/timer-estudo.tsx` (client)

> **Reusa `registrarEstudo` (já aceita `inicio`/`fim`).** Zero migration, zero action nova para o caso base.

- **Props:** `{ materiaId, materiaNome, subtemaId?, tipoEstudo?, blocoId?, minutosAlvo?, onLogged? }`.
- **Estado (Zustand `useTimerStore`, único timer ativo):** `{ blocoId?, materiaId, subtemaId?, startedAt }`
  persistido em `localStorage` → sobrevive a refresh/aba fechada. "Estudar" é singular: **um timer por vez**;
  iniciar outro pede para parar o atual.
- **UI:** idle → botão **Iniciar**; rodando → cronômetro `mm:ss` + **Parar** (e **Pausar** opcional).
- **Ao Parar:**
  ```
  minutos = round((Date.now() − startedAt)/60000)
  if (minutos < 1) → toast "sessão curta demais, não registrada" (descarta)
  else registrarEstudo({ materiaId, subtemaId, tipoEstudo: tipoEstudo ?? 'leitura',
                         minutos, inicio: ISO(startedAt), fim: ISO(now) })
  if (blocoId) → marcarBlocoFeito(blocoId, 'em_andamento')   // ao iniciar
  onLogged?.()  // recarrega o header de saldo do plano-do-dia
  ```
- **Amarração a bloco:** quando aberto a partir de um bloco do cronograma, pré-preenche
  matéria/subtema/tipo e mostra progresso `Σ tempo do bloco / minutos_alvo`. Concluir (`feito`) fica
  **explícito** com a usuária (não auto-feito — evita fechar cedo). `[AUTO-DECISION]` start→`em_andamento`,
  conclusão manual (razão: mantém controle da usuária; auto-feito por `>= minutos_alvo` fica Fatia B).
- **Confiança do dado (boundary):** quando `inicio`+`fim` chegam (caminho timer), o **servidor
  recomputa** `minutos = round((fim−inicio)/60000)` e usa esse valor (não confia cego no client);
  caminho manual continua usando os minutos digitados. Ver §8.

### 5.2 Plano do Dia unificado — `/plano` (rota mantida; vira o cockpit de HOJE)

**O que aparece (de cima pra baixo):**
1. **Header de aderência** (de `v_saldo_diario` de hoje + `v_saldo_mensal` + `saldo.ts`):
   - **Meta de hoje:** `meta_do_dia` (mostra "base 180" ou "override 300 — viagem"); botão **ajustar
     meta de hoje** (grava `metas_diarias`).
   - **Tempo de hoje:** `real_min` (atualiza ao parar o timer).
   - **Saldo de hoje:** `+/− min` (superávit/déficit), com `saldo_acum_mes` ("no mês: −90 min").
   - **Meta mensal:** barra `real_mes / meta_mensal_min` (%); abaixo, o ritmo: *"faltam 1800 min em 9
     dias = 200 min/dia"* + rótulo **adiantada/no ritmo/atrasada**. Se atrasada → botão **Compensar**
     (Nível A: abre ajuste de metas dos dias restantes; Nível B futuro: 1 clique).
2. **Blocos de HOJE** (de `cronograma_blocos WHERE data_alvo = hoje`, ordenados por `ordem`) —
   **conteúdo + questões + revisão** juntos. Cada card:
   - matéria/subtema, badge de tipo, `minutos_alvo`;
   - **bloco de questões** mostra a **quota de questões** = `minutos_alvo × qph` (velocidadeQhDefault)
     e botão **Treinar** → `/treino` (gera/usa `plano_diario` via `gerarPlanoDiario` **reusado**);
   - **botão Timer** embutido (cronometra contra aquele bloco);
   - checkbox **feito** (reusa `marcarBlocoFeito`).
   - Vazio (sem cronograma) → estado "gere seu roteiro" com link para `/cronograma`.
3. **Registrar manualmente** (atalho para `/registro`, para quem estudou sem timer).

**O que acontece com o `/plano` antigo (só questões):** **fold-in, sem perda.**
- A página `/plano` é **reescrita** para o cockpit acima.
- O **input "horas disponíveis hoje"** sai (a meta vira a fonte) → substituído por **meta de hoje +
  ajustar**.
- `PlanoControls` + `ExplicacaoPlano` (a distribuição de questões com motivos reforço/medir/ética/
  espaçado) são **realocados** para o **detalhe do bloco de questões** (expandir o card, ou em `/treino`).
- `gerarPlanoDiario`/`carregarPlanoDoDia`/`plano_diario` **permanecem** (motor das questões do dia).
  Nada de capacidade perdida — só reposicionada dentro do bloco. `[AUTO-DECISION]` manter a URL `/plano`
  como "plano do dia" (o nav já diz "Plano do dia") e deixar `/cronograma` como o **horizonte**
  (razão: dois modos mentais distintos — executar-hoje vs planejar-semanas — merecem duas rotas; menos
  churn de URL).

### 5.3 Cronograma (horizonte) — `/cronograma` (mantém papel, ganha metas)
- Vira a tela de **planejamento multi-dia** (semana/mês até 06/09).
- O input "horas/dia" do `cronograma-controls` passa a ser **meta base diária** → no submit chama
  `definirMetaBase(min)` e depois `gerarCronograma()`. (Compatível: se ainda vier `horas`, semeia a base.)
- Mostra cada dia com sua **meta** (base/override) e os blocos; permite **override por dia** inline
  (ex.: "sábado 8h") e **Regenerar** (= re-plan) e **Compensar** (= re-plan com dias maiores).

### 5.4 Metas — `/metas` (rota nova, opcional na Fatia A) ou painel em `/cronograma`
- Define **meta base diária**, **meta mensal**, **dias de estudo** (toggles Dom..Sáb) e **timezone**.
- Lista/edita **overrides** por dia (calendário simples).
- `[AUTO-DECISION]` Fatia A entrega o **mínimo**: setar base + mensal + override-de-hoje (no header do
  `/plano`) e base/dias no `/cronograma`. A página `/metas` dedicada (calendário de overrides) é Fatia B.

### 5.5 Saldo mensal (visão) — Fatia B
- `v_saldo_mensal` + `v_saldo_diario` em **Recharts** (já na stack): barra real×meta por dia do mês,
  linha de saldo acumulado, anel de progresso da meta mensal. Heatmap de aderência (Fatia B+).

---

## 6. FATIAMENTO

> Migration (§2.4) entra **inteira** na Fatia A (fundação). Fatiamento abaixo governa **código/UI**.

### FATIA A — "o loop de aderência fecha" (próxima construível)
**DoD:** a Kamile define meta, **cronometra**, vê **saldo de hoje + acumulado do mês + progresso da
meta mensal**, e o **plano-do-dia unificado** mostra conteúdo+questões com a meta/tempo/saldo no topo.

| Entregável | Arquivos |
|------------|----------|
| Migration metas + saldo | `supabase/migrations/20260626130000_metas_aderencia.sql` + `supabase gen types` |
| Tipos de domínio | APPEND em `src/lib/types/domain.ts` (`MetasEstudo`, `MetaDiaria`, `SaldoDia`, `SaldoMes`) |
| Constantes | APPEND em `src/lib/planner/config.ts` (`metaBaseDiariaDefaultMin=180`, `minutosTetoCompensacao`, `fatorTetoCompensacao=1.5`) |
| Saldo puro | `src/lib/metas/saldo.ts` (ritmo, dias restantes, status, proposta) + teste Vitest |
| Actions de metas | `src/app/(estudo)/_actions/metas.actions.ts` (`carregarMetas`, `definirMetaBase`, `definirMetaMensal`, `definirDiasEstudo`, `definirOverrideDia`) |
| Actions de saldo | `src/app/(estudo)/_actions/saldo.actions.ts` (`carregarSaldoDiario(range)`, `carregarSaldoMensal`, `carregarAderenciaHoje`) |
| Timer | `src/components/estudo/timer-estudo.tsx` + `src/lib/stores/timer-store.ts` (Zustand) |
| Gerador per-day budget | **EXTEND** `src/lib/planner/cronograma.ts` (§4.2/4.3 — DEPOIS do fix) + teste |
| Cronograma action lê metas | **EXTEND** `src/app/(estudo)/_actions/cronograma.actions.ts` (monta `metaPorDiaMin` + `diasEstudo`) |
| Plano-do-dia unificado | **REWRITE** `src/app/(estudo)/plano/page.tsx` + novo `plano-do-dia.tsx` (client); **realocar** `PlanoControls`/`ExplicacaoPlano` p/ detalhe do bloco de questões |
| Timer no registro | **EXTEND** `src/app/(estudo)/registro/registro-form.tsx` (botão Timer) |
| Nav | **EXTEND** `src/app/(estudo)/layout.tsx` (link `/metas` se a página existir) |

### FATIA B — "fica rico"
- `/metas` dedicada (calendário de overrides, toggles de dias, timezone).
- **Compensação 1 clique** (`aplicarCompensacao` grava overrides + re-plan).
- Timer embutido nos cards do `/plano`; auto-`em_andamento`; pausa; auto-`feito` por `>= minutos_alvo`.
- Visão de saldo mensal em Recharts (barras/linha/anel) + saldo semanal.

### DEPOIS / DROP 2
- Superfície de `v_esforco_resultado` (já no banco) — quadrantes esforço×resultado.
- Materialized views só se medir lentidão (escala single-user é pequena).
- Alinhar "hoje" do app ao fuso (corrigir drift UTC pré-existente — ver §8/M-7).

---

## 7. Pedidos exatos

### 7.1 Ao @data-engineer (Dara) — DDL
DDL completo no §2.4 (copiar/colar como `20260626130000_metas_aderencia.sql`). Atenção:

- **M-1 (aditivo absoluto):** só `CREATE`/`CREATE OR REPLACE`. Nenhum `ALTER`/`DROP` em objeto
  existente. Não tocar `estudo_sessoes`/`cronograma_blocos`/`diag_*`/pilar de questões.
- **M-2 (`metas_estudo` singleton):** `UNIQUE(user_id)`. `dias_estudo` com `CHECK <@ {0..6}`.
  `timezone` default `America/Sao_Paulo`.
- **M-3 (`metas_diarias` override):** `UNIQUE(user_id, data)`, `minutos_meta` `CHECK 0..1440`
  (0 = folga). A app fará **UPSERT** por `(user_id, data)`.
- **M-4 (`meta_do_dia`):** `STABLE`, `SET search_path=''`, fully-qualified, `SECURITY INVOKER` (default).
  Ordem: override → base-se-dia-de-estudo → 0. `EXTRACT(DOW)::smallint = ANY(dias_estudo)`.
- **M-5 (RLS espelhada):** as 2 tabelas seguem **exatamente** `20260626120000` (ENABLE+FORCE +
  policies `_select/_insert/_update/_delete_own`, `auth.uid()=user_id`). `user_id` direto → **sem**
  trigger de sync.
- **M-6 (views `security_invoker=on`):** ambas. Herdam RLS de `estudo_sessoes`/`metas_*`.
- **M-7 (timezone-aware — corretude):** o bucket de dia/mês é
  `(es.ts AT TIME ZONE me.timezone)::date`. **Não** usar `date(ts)` cru (cairia no dia errado à noite).
- **M-8 (âncora da série):** `v_saldo_diario` ancora em `MIN(dia da 1ª sessão)` → sem déficit fantasma.
  `generate_series` até hoje no fuso.
- **M-9 (regen de tipos):** após `supabase db push`, rodar
  `supabase gen types typescript --local > src/lib/types/db.types.ts`. Não editar à mão.
- **M-10 (perf, informativo):** `meta_do_dia` é `STABLE` com `search_path` setado → pode não fazer
  inline no `generate_series`. Em single-user (poucas centenas de dias) é irrelevante. Materializar
  só se medir lentidão.

### 7.2 Ao @dev (Dex) — arquivos e limites

**⚠️ Conflito com o fix em andamento:** a mudança de **meta-por-dia** em `cronograma.ts` (§4) entra
**DEPOIS** do commit do fix de ordenação (prioridade + conteúdo-antes-de-questões) e é o **diff dos 4
pontos** do §4.3 — **não** reescrever as fases nem o round-robin. Se o fix ainda não fechou, **espere**:
sua mudança é por cima (rebase trivial — você só troca `budgetDiario` escalar por `budgetDoDia(d)`).

**Arquivos NOVOS (zero conflito)**
```
src/lib/metas/saldo.ts                              # puro: ritmo, dias restantes, status, proposta (+ teste)
src/lib/stores/timer-store.ts                       # Zustand: timer único + persist localStorage
src/components/estudo/timer-estudo.tsx              # client: start/stop → registrarEstudo (inicio/fim)
src/app/(estudo)/_actions/metas.actions.ts          # carregar/definir base/mensal/dias/override (UPSERT)
src/app/(estudo)/_actions/saldo.actions.ts          # carregar saldo diário/mensal/aderência-de-hoje
src/app/(estudo)/plano/plano-do-dia.tsx             # client: cockpit de hoje (header + blocos + timer)
tests/unit/saldo.test.ts                            # Vitest (puro)
# Fatia B: src/app/(estudo)/metas/page.tsx + form ; compensação 1-clique ; gráficos Recharts
```

**Arquivos EXTENDIDOS (append/diff cirúrgico — baixo risco)**
```
src/lib/planner/cronograma.ts   # §4.3 — DEPOIS do fix. Add metaPorDiaMin + budgetDoDia(d). NÃO mexer nas fases.
src/lib/planner/config.ts        # APPEND metaBaseDiariaDefaultMin, fatorTetoCompensacao, minutosTetoCompensacao
src/lib/types/domain.ts          # APPEND MetasEstudo, MetaDiaria, SaldoDia, SaldoMes. NÃO alterar os existentes.
src/app/(estudo)/_actions/cronograma.actions.ts  # ler metas → montar metaPorDiaMin + diasEstudo; seed base se vazio
src/app/(estudo)/plano/page.tsx  # REWRITE p/ cockpit (RSC carrega aderência + blocos de hoje)
src/app/(estudo)/cronograma/cronograma-controls.tsx  # "horas/dia" → "meta base diária" (definirMetaBase + gerar)
src/app/(estudo)/registro/registro-form.tsx          # ADD botão Timer (reusa registrarEstudo)
src/app/(estudo)/layout.tsx      # ADD link /metas (se a página existir). NÃO refatorar.
```

**REALOCAR (preservar capacidade — não apagar)**
```
src/app/(estudo)/plano/plano-controls.tsx   # PlanoControls/ExplicacaoPlano → detalhe do bloco de questões (ou /treino)
# gerarPlanoDiario / carregarPlanoDoDia / plano_diario  → PERMANECEM (motor das questões do dia)
```

**NÃO TOCAR (fronteira)**
```
src/lib/planner/planner.ts                  # reusar via import (gerarPlano p/ questões do dia)
src/lib/diagnostico/*                         # reusar
src/app/(teste)/* , src/app/(verificacao)/*   # pilar de questões + gabarito
src/lib/correcao/* , supabase/migrations/2026062*  # já aplicadas
src/lib/types/db.types.ts                     # gerado por supabase gen types (não editar à mão)
```

**Contratos das Server Actions (forma `{ ok, ... }` — padrão da casa)**
```ts
// metas.actions.ts
carregarMetas(): Promise<MetasEstudo | null>;
definirMetaBase(min: number): Promise<{ ok: true } | { ok: false; erro: string }>;      // UPSERT singleton
definirMetaMensal(min: number | null): Promise<{ ok: true } | { ok: false; erro: string }>;
definirDiasEstudo(dias: number[]): Promise<{ ok: true } | { ok: false; erro: string }>;
definirOverrideDia(data: string, minutos: number, nota?: string):                       // UPSERT (user,data)
  Promise<{ ok: true } | { ok: false; erro: string }>;
removerOverrideDia(data: string): Promise<{ ok: true } | { ok: false; erro: string }>;

// saldo.actions.ts
carregarSaldoDiario(range: "semana" | "mes"): Promise<SaldoDia[]>;
carregarSaldoMensal(): Promise<SaldoMes | null>;          // mês corrente (default 0 se sem sessão)
carregarAderenciaHoje(): Promise<{                         // monta o header do /plano (saldo.ts)
  metaHojeMin: number; realHojeMin: number; saldoHojeMin: number;
  saldoAcumMesMin: number; realMesMin: number; metaMensalMin: number | null;
  diasRestantesMes: number; ritmoNecessarioMin: number; status: "adiantada"|"no_ritmo"|"atrasada";
} | null>;
```

**Obrigatório nas actions:**
- **Zod** na fronteira: `min` inteiro `0..1440`; `meta_mensal` `0..44640` ou null; `dias ⊆ {0..6}`;
  `data` ISO `YYYY-MM-DD`; `nota` `max 500`.
- **`auth.getUser()`** + `user_id = user.id` em todo write (RLS exige; espelha `planner.actions.ts`).
- **UPSERT** `metas_estudo` por `user_id` e `metas_diarias` por `(user_id, data)` (`onConflict`).
- **Timer (trust boundary):** quando `inicio`+`fim` vierem em `registrarEstudo`, **recomputar**
  `minutos` server-side de `(fim − inicio)` (não confiar no client); manual segue digitado.
- **"Hoje" no fuso:** novas leituras de "hoje" usam o `timezone` de `metas_estudo` (helper
  `hojeLocal(tz)`), para casar com o bucket das views. Ver §8.

---

## 8. Trade-offs, segurança e compatibilidade

### Trade-offs decididos
| Decisão | Alternativa | Por que esta |
|---------|-------------|--------------|
| `dias_estudo`+`timezone` em `metas_estudo` | só base/mensal/override | unifica "quais dias contam" e corrige o bucket de dia — uma fonte p/ saldo E cronograma |
| Saldo **diário (Σmeta)** E **mensal (contrato)** separados | um número só | owner pediu ambos; disciplina-de-ritmo ≠ contrato-mensal; podem divergir e tudo bem |
| Ritmo/compensação no **app** (`saldo.ts`) | tudo em SQL | fato em SQL, recomendação no app (§4 anti-chute); testável; `dataProva` é config do app |
| Meta-por-dia = **swap escalar→lookup** | reescrever o gerador | constrói EM CIMA do `earliestFit` do fix; diff mínimo; fases intactas |
| Timer **reusa** `registrarEstudo` | action nova | `inicio`/`fim` já existem no schema/contrato; menos superfície |
| `/plano` = cockpit de hoje; `/cronograma` = horizonte | fundir numa rota só | dois modos mentais distintos; menos churn; nav já diz "Plano do dia" |
| Compensação cai de graça do re-plan | motor de re-distribuição dedicado | metas + regenerar-de-hoje (já existe) já re-espalham o conteúdo |

### Segurança (flags)
- **Sem superfície de gabarito.** Metas/saldo/timer **não tocam** `questoes.gabarito` nem o fluxo de
  prova — a **fronteira de segurança nº1 permanece intacta**.
- **Dados 100% da usuária** → RLS `auth.uid()=user_id` + **FORCE** nas 2 tabelas novas; views
  `security_invoker=on` (herdam RLS). `meta_do_dia` é `SECURITY INVOKER` → não vaza entre usuárias.
- **Trust boundary do timer:** o servidor **recomputa** `minutos` de `(fim−inicio)` quando o caminho
  é timer — o cliente não dita minutos arbitrários. Manual continua validado por Zod (`1..720`).
- **Free text** (`metas_diarias.nota`): renderizar como **texto** (React escapa; nunca
  `dangerouslySetInnerHTML`).
- **Validação Zod** obrigatória em todas as actions (input não confiável).
- **⚠️ Corretude de fuso (flag, parcialmente pré-existente):** as actions atuais
  (`cronograma.actions.ts`, `planner.actions.ts`) computam "hoje" com `new Date().toISOString()
  .slice(0,10)` = **data UTC**. À noite no BRT isso aponta o **dia seguinte**. As views novas bucketam
  pelo **fuso da usuária** — para o saldo bater com "hoje" do app, o código novo deve usar `hojeLocal(tz)`.
  O drift pré-existente fica **sinalizado** (alinhar no Drop 2, fora do escopo aditivo de agora).

### Compatibilidade (backward)
- **Aditivo puro.** Rollback = `DROP` das 2 tabelas + 2 views + 1 função; o resto fica idêntico.
- **Gerador retro-compatível:** `metaPorDiaMin` é **opcional**; sem ele, o gerador usa o escalar
  `horasPorDia` exatamente como hoje. A UI antiga (`gerarCronograma(horas)`) continua válida (semeia base).
- **`/plano` antigo:** capacidade **preservada** (planner de questões realocado, não removido;
  `plano_diario` intacto).
- **Local→cloud sem retrabalho:** mesma migration roda no Supabase da Kamile no deploy
  (`supabase db push`), como toda a estratégia local-first.
- **Multi-user ready:** `user_id` em tudo; `metas_estudo` singleton por `UNIQUE(user_id)`.

---

## 9. Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-06-26 | v1.0 | Cockpit v2 — LOOP DE ADERÊNCIA: schema aditivo (`metas_estudo`, `metas_diarias` + `meta_do_dia()` + views `v_saldo_diario`/`v_saldo_mensal`, timezone-aware, RLS single-user); matemática de saldo/ritmo/compensação no app (`saldo.ts`); mudança meta-por-dia no gerador como swap escalar→lookup EM CIMA do fix de ordenação; timer reusando `registrarEstudo`; unificação do plano-do-dia (`/plano`=hoje, `/cronograma`=horizonte, planner de questões realocado sem perda); fatiamento A/B; pedidos a @data-engineer (DDL pronto, M-1..M-10) e @dev (arquivos/limites/contratos). | Aria (@architect) |
