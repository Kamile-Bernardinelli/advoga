# Advoga — Cockpit de Estudo (Drop 1.5)

> **Autor:** Aria (@architect) · **Data:** 2026-06-26 · **Status:** v1.0 (design — NÃO implementado)
> **Modelo:** Opus (decisão de arquitetura) · **Owner:** Marcos · **Usuária:** Kamile
> **Restrição-mãe:** prova OAB 1ª fase **06/09/2026** (~**72 dias** em 2026-06-26).
> **Pré-requisitos lidos:** `docs/architecture/fullstack-architecture.md`, `docs/architecture/SCHEMA.md`, migrations `20260621*`, `src/lib/planner/*`, `src/lib/diagnostico/*`, route group `src/app/(estudo)/*`.
> **Natureza:** **ADITIVO**. Nenhuma tabela, view, enum, policy ou arquivo existente é alterado. O pilar de questões continua intacto.

---

## 0. Por que este pilar existe (1 parágrafo)

Hoje o Advoga é **question-centric**: a Kamile faz provas → o motor de diagnóstico mede acerto por matéria/subtema/dimensão. Falta o outro lado da equação: **o esforço**. A Kamile vai **estudar conteúdo** (ler material, seguir um roteiro) e precisamos **capturar quanto tempo** ela gastou em cada coisa (tema, material, local) para, depois, **cruzar tempo-aplicado × resultado-nas-questões** ("estudei 6h de Posse e ainda erro" vs. "nunca toquei em Recursos e vou mal"). O Drop 1.5 entrega **o sensor de tempo + o roteiro de estudo**. A análise fina do cruzamento é Drop 2 — mas o **dado começa a ser capturado HOJE**, porque dado de esforço não tem retroatividade: o que não for medido agora está perdido para sempre.

**Princípio condutor (subordinado à restrição-mãe):** a Fatia 1 existe para a Kamile **começar a estudar com roteiro e registrar tempo já**. Tudo que não serve a esse objetivo imediato é Fatia 2 ou parking lot.

---

## 1. Princípios desta extensão (não negociáveis)

1. **100% aditivo — zero quebra.** Só `CREATE TABLE/TYPE/VIEW/POLICY/INDEX`. Nenhum `ALTER`/`DROP` em objeto existente. Se a migration falhar, o pilar de questões continua de pé.
2. **Espelhar o que já existe.** Os 3 padrões da casa são lei: (a) enums via `DO`-block guard; (b) `user_id → auth.users` + RLS `auth.uid() = user_id` com policies `{tabela}_{select|insert|update|delete}_own` + `ENABLE`/`FORCE`; (c) `created_at/updated_at` + trigger `trg_set_updated_at` reutilizando `public.set_updated_at()`. Não reinventar.
3. **Sensor primeiro, análise depois.** `estudo_sessoes` é um **log plano** (1 linha = 1 evento de estudo). Captura é barata e irreversível-se-perdida; portanto a Fatia 1 prioriza a captura sobre qualquer dashboard.
4. **Anti-chute também no esforço.** O cruzamento tempo×resultado **nunca** declara um padrão ("muito tempo, pouco acerto") sem **volume duplo**: tempo mínimo **E** questões mínimas (gate ≥8 reaproveitado). Abaixo disso: "medindo". Fato (números) e recomendação (rótulo do quadrante) são camadas separadas, como no §4 do brief.
5. **Reuso > criação (IDS).** O gerador de cronograma **reusa** `weaknessScore`/`ranquearNos`/`config.ts`/`gerarPlano` do `src/lib/planner`. Não duplica scoring. A view de cruzamento **reusa** `diag_por_no` (a view real de acerto-por-nó) — não recalcula taxa.
6. **Taxonomia, não edital.** Fato confirmado: o edital da 1ª fase **não tem conteúdo programático detalhado**. O cronograma se ancora na **nossa taxonomia** (matérias/subtemas) ordenada por incidência×fraqueza, e no **calendário** (hoje→06/09/2026). O edital só contribui datas/marcos (Anexo V) e a regra **≥15% Ética/CED/DH/Filosofia** — que vira a **dose garantida de Ética** do gerador.

---

## 2. Schema novo (migration aditiva)

**Um único arquivo de migration**, aplicado de uma vez (é a fundação; as 3 tabelas têm FKs entre si, então não dá para fatiar o DDL). O **fatiamento é de UI/código (@dev)**, não de schema.

- **Arquivo:** `supabase/migrations/20260626120000_study_cockpit.sql`
- **Numeração:** posterior a `20260621130000` (último existente). Ordem lexicográfica preservada.
- **Idempotente:** `IF NOT EXISTS` / `DO`-block guards, como as migrations da casa.

### 2.1 Enums novos (sem colisão com os existentes)

| Enum | Valores | Usado em |
|------|---------|----------|
| `material_tipo` | `livro, pdf, video, curso, lei, resumo, outro` | `materiais.tipo` |
| `tipo_estudo` | `leitura, video, resumo, revisao, questoes, outro` | `estudo_sessoes.tipo_estudo` |
| `cronograma_tipo` | `conteudo, questoes, revisao` | `cronograma_blocos.tipo` |
| `bloco_status` | `pendente, em_andamento, feito` | `cronograma_blocos.status` |
| `bloco_origem` | `gerado, manual` | `cronograma_blocos.origem` |

### 2.2 Tabelas (resumo)

| Tabela | Papel | Colunas-chave | RLS |
|--------|-------|---------------|-----|
| `materiais` | catálogo de materiais da usuária | `user_id`, `nome`, `tipo`, `referencia` (url/livre), `UNIQUE(user_id,nome)` | `auth.uid()=user_id` |
| `estudo_sessoes` | **O SENSOR** — log de tempo | `user_id`, `materia_id`(NOT NULL), `subtema_id?`, `micro_topico_id?`, `material_id?`, `local`, `tipo_estudo`, `inicio?`, `fim?`, `duracao_min`(NOT NULL), `anotacao?`, `ts` | `auth.uid()=user_id` |
| `cronograma_blocos` | **O ROTEIRO** — blocos no calendário | `user_id`, `data_alvo`, `materia_id`(NOT NULL), `subtema_id?`, `tipo`, `minutos_alvo`, `status`, `ordem`, `origem` | `auth.uid()=user_id` |

**Decisão de design importante — `duracao_min` é coluna real (NÃO `GENERATED`).** `sessoes.duracao_seg` é `GENERATED ALWAYS AS (fim - inicio)` porque uma prova sempre tem início/fim. O **sensor de estudo é diferente**: na **entrada manual** (Fatia 1) a Kamile digita os minutos **sem** início/fim. Então `duracao_min` é o **payload canônico** (sempre presente, `NOT NULL CHECK > 0`); `inicio`/`fim` são metadados opcionais (preenchidos só pelo timer da Fatia 2). Derivar `duracao_min` de `fim-inicio` quebraria a entrada manual — por isso a divergência deliberada do padrão de `sessoes`.

**`materia_id NOT NULL` no sensor.** Todo evento de estudo é ancorado a uma matéria — é o que torna o cruzamento tempo×resultado possível. `ON DELETE RESTRICT` (proteger o fato histórico, como `questoes.materia_id` no design original). Já `cronograma_blocos.materia_id` usa `ON DELETE CASCADE` (um bloco é plano descartável, não fato).

### 2.3 Views novas

| View | Entrega | Reuso |
|------|---------|-------|
| `v_tempo_por_no` | tempo agregado (Σ `duracao_min`, nº de sessões, último_ts) por **eixo de conteúdo** (`materia`/`subtema`/`micro`), no formato `eixo/no_id/no_nome` — UNION, espelhando `diag_por_no` | mesma forma de chave que `diag_por_no` → joinável |
| `v_esforco_resultado` | **o cruzamento**: `FULL OUTER JOIN` `v_tempo_por_no` × `diag_por_no` por `(user_id, eixo, no_id)`. Expõe `total_min, n_feitas, n_acertos, taxa, tempo_ok, questoes_ok, padrao_confiavel`. **Gate duplo anti-chute.** | reusa `diag_por_no` (não recalcula acerto) |

**Gate duplo (anti-chute do esforço):**
- `tempo_ok` = `total_min >= public.esforco_gate_tempo_min()` (nova função, single source of truth, default **60 min** — calibrável trocando 1 função, espelhando `diag_gate_minimo()`).
- `questoes_ok` = `n_feitas >= public.diag_gate_minimo()` (reusa o gate ≥8 existente).
- `padrao_confiavel` = `tempo_ok AND questoes_ok` **E ambos os lados do JOIN presentes**. A view **expõe os sinais crus**; o **rótulo do quadrante** ("esforço sem retorno", "subexposto", "dominado", "eficiente") é decidido no app (`src/lib/diagnostico/esforco.ts`, puro) e só quando `padrao_confiavel = true`. Caso contrário: `"medindo"`. Isso mantém o §4: número = fato; rótulo = recomendação rastreável.

> `FULL OUTER JOIN` (não INNER) de propósito: precisamos enxergar os quadrantes com **um lado nulo** — "estudou e não fez questão" (tempo sem acerto) e "vai mal e nunca estudou" ("sem tempo + fraco", verbatim da missão). INNER esconderia exatamente os casos mais acionáveis.

### 2.4 DDL exato (entregável para o @data-engineer — copiar/colar)

```sql
-- =============================================================================
-- Advoga — Cockpit de Estudo (Drop 1.5) — SCHEMA ADITIVO
-- Migration: 20260626120000_study_cockpit.sql
-- Author: Dara (@data-engineer) · Design: Aria (@architect)
-- Depends on: 20260621120000 (tabelas/enum/trigger), 120001 (diag views + gate),
--             120002 (RLS), 120003 (diag_por_no com d-8/security_invoker)
-- =============================================================================
-- PURPOSE
--   Pilar NOVO de estudo (complementa o pilar de questões, intocado):
--     materiais        — catálogo de materiais da usuária
--     estudo_sessoes   — SENSOR: log de tempo de estudo (1 linha = 1 evento)
--     cronograma_blocos— ROTEIRO: blocos de estudo no calendário até a prova
--     v_tempo_por_no   — tempo agregado por nó de conteúdo (espelha diag_por_no)
--     v_esforco_resultado — CRUZAMENTO tempo × acerto, com GATE DUPLO anti-chute
--
-- ADITIVO: nenhum ALTER/DROP em objeto existente. Seguro re-rodar (idempotente).
-- =============================================================================

BEGIN;

-- pgcrypto já existe (init_schema). set_updated_at() já existe — reutilizado.

-- -----------------------------------------------------------------------------
-- 1. ENUMS (DO-block guard — padrão da casa; CREATE TYPE não aceita IF NOT EXISTS)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.material_tipo AS ENUM
    ('livro','pdf','video','curso','lei','resumo','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_estudo AS ENUM
    ('leitura','video','resumo','revisao','questoes','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cronograma_tipo AS ENUM ('conteudo','questoes','revisao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bloco_status AS ENUM ('pendente','em_andamento','feito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bloco_origem AS ENUM ('gerado','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. MATERIAIS — catálogo de materiais de estudo da usuária
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materiais (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  tipo        public.material_tipo NOT NULL DEFAULT 'outro',
  referencia  text,                       -- url OU referência livre (ed., capítulo…)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materiais_user_nome_uniq UNIQUE (user_id, nome)
);
COMMENT ON TABLE public.materiais IS
  'Catálogo de materiais de estudo da usuária (livro/pdf/video/curso/lei/resumo). RLS auth.uid()=user_id.';

-- -----------------------------------------------------------------------------
-- 3. ESTUDO_SESSOES — O SENSOR: log de tempo (1 linha = 1 evento de estudo)
--   duracao_min é coluna REAL (não GENERATED): entrada manual digita os minutos
--   sem inicio/fim. inicio/fim são metadados opcionais (timer da Fatia 2).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estudo_sessoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  materia_id      uuid NOT NULL REFERENCES public.materias(id)      ON DELETE RESTRICT,
  subtema_id      uuid          REFERENCES public.subtemas(id)      ON DELETE SET NULL,
  micro_topico_id uuid          REFERENCES public.micro_topicos(id) ON DELETE SET NULL,
  material_id     uuid          REFERENCES public.materiais(id)     ON DELETE SET NULL,
  local           text,
  tipo_estudo     public.tipo_estudo NOT NULL DEFAULT 'leitura',
  inicio          timestamptz,                  -- opcional (timer)
  fim             timestamptz,                  -- opcional (timer)
  duracao_min     integer NOT NULL CHECK (duracao_min > 0),  -- PAYLOAD canônico
  anotacao        text,
  ts              timestamptz NOT NULL DEFAULT now(),         -- quando o evento ocorreu
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estudo_micro_requer_subtema
    CHECK (micro_topico_id IS NULL OR subtema_id IS NOT NULL),
  CONSTRAINT estudo_fim_apos_inicio
    CHECK (fim IS NULL OR inicio IS NULL OR fim >= inicio)
);
COMMENT ON TABLE public.estudo_sessoes IS
  'SENSOR de tempo de estudo (1 linha = 1 evento). duracao_min é canônico (entrada manual). '
  'inicio/fim opcionais (timer Fatia 2). Base do cruzamento tempo×resultado (v_esforco_resultado).';
COMMENT ON COLUMN public.estudo_sessoes.duracao_min IS
  'Minutos estudados. Coluna real (não GENERATED) p/ permitir entrada manual sem inicio/fim.';

-- -----------------------------------------------------------------------------
-- 4. CRONOGRAMA_BLOCOS — O ROTEIRO: blocos de estudo no calendário
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cronograma_blocos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  data_alvo    date NOT NULL,
  materia_id   uuid NOT NULL REFERENCES public.materias(id)  ON DELETE CASCADE,
  subtema_id   uuid          REFERENCES public.subtemas(id)  ON DELETE SET NULL,
  tipo         public.cronograma_tipo NOT NULL DEFAULT 'conteudo',
  minutos_alvo integer NOT NULL CHECK (minutos_alvo > 0),
  status       public.bloco_status NOT NULL DEFAULT 'pendente',
  ordem        smallint NOT NULL DEFAULT 0,         -- ordem dentro do dia
  origem       public.bloco_origem NOT NULL DEFAULT 'gerado',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.cronograma_blocos IS
  'ROTEIRO de estudo: blocos (conteudo|questoes|revisao) no calendário até a prova. '
  'origem=gerado (planner) | manual (Kamile). Re-geração preserva feito/manual.';

-- -----------------------------------------------------------------------------
-- 5. ÍNDICES (access patterns: agregação de tempo + leitura do cronograma)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_estudo_user        ON public.estudo_sessoes (user_id);
CREATE INDEX IF NOT EXISTS idx_estudo_user_ts      ON public.estudo_sessoes (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_estudo_materia      ON public.estudo_sessoes (materia_id);
CREATE INDEX IF NOT EXISTS idx_estudo_subtema      ON public.estudo_sessoes (subtema_id);
CREATE INDEX IF NOT EXISTS idx_estudo_material     ON public.estudo_sessoes (material_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_user_data ON public.cronograma_blocos (user_id, data_alvo);
CREATE INDEX IF NOT EXISTS idx_cronograma_user_status ON public.cronograma_blocos (user_id, status);
CREATE INDEX IF NOT EXISTS idx_materiais_user      ON public.materiais (user_id);

-- -----------------------------------------------------------------------------
-- 6. TRIGGERS updated_at (reusa public.set_updated_at())
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; tbls text[] := ARRAY['materiais','estudo_sessoes','cronograma_blocos'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 7. RLS single-user — espelha 20260621120002 (sessoes/respostas/plano_diario)
--    user_id direto em todas → sem trigger de sync (diferente de respostas).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text; tbls text[] := ARRAY['materiais','estudo_sessoes','cronograma_blocos'];
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
-- 8. GATE DE TEMPO — single source of truth do limiar anti-chute de esforço
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esforco_gate_tempo_min()
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT 60 $$;   -- minutos mínimos p/ declarar padrão de esforço (calibrável)
COMMENT ON FUNCTION public.esforco_gate_tempo_min() IS
  'Limiar anti-chute de ESFORÇO: minutos mínimos p/ declarar padrão tempo×resultado. Default 60.';

-- -----------------------------------------------------------------------------
-- 9. VIEW v_tempo_por_no — tempo agregado por nó de conteúdo (espelha diag_por_no)
--    Mesma chave (user_id, eixo, no_id) → joinável com diag_por_no.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_tempo_por_no
WITH (security_invoker=on) AS
WITH materia AS (
  SELECT es.user_id, 'materia'::text AS eixo, es.materia_id::text AS no_id,
         m.nome AS no_nome, sum(es.duracao_min) AS total_min,
         count(*) AS n_sessoes, max(es.ts) AS ultimo_ts
  FROM public.estudo_sessoes es
  JOIN public.materias m ON m.id = es.materia_id
  GROUP BY es.user_id, es.materia_id, m.nome
),
subtema AS (
  SELECT es.user_id, 'subtema'::text AS eixo, es.subtema_id::text AS no_id,
         s.nome AS no_nome, sum(es.duracao_min) AS total_min,
         count(*) AS n_sessoes, max(es.ts) AS ultimo_ts
  FROM public.estudo_sessoes es
  JOIN public.subtemas s ON s.id = es.subtema_id
  WHERE es.subtema_id IS NOT NULL
  GROUP BY es.user_id, es.subtema_id, s.nome
),
micro AS (
  SELECT es.user_id, 'micro'::text AS eixo, es.micro_topico_id::text AS no_id,
         mt.nome AS no_nome, sum(es.duracao_min) AS total_min,
         count(*) AS n_sessoes, max(es.ts) AS ultimo_ts
  FROM public.estudo_sessoes es
  JOIN public.micro_topicos mt ON mt.id = es.micro_topico_id
  WHERE es.micro_topico_id IS NOT NULL
  GROUP BY es.user_id, es.micro_topico_id, mt.nome
)
SELECT * FROM materia
UNION ALL SELECT * FROM subtema
UNION ALL SELECT * FROM micro;

COMMENT ON VIEW public.v_tempo_por_no IS
  'Tempo de estudo agregado por nó de conteúdo (materia|subtema|micro). '
  'Mesma chave (user_id,eixo,no_id) de diag_por_no → cruzável. security_invoker=on.';

-- -----------------------------------------------------------------------------
-- 10. VIEW v_esforco_resultado — CRUZAMENTO tempo × acerto (gate DUPLO)
--    FULL OUTER JOIN p/ capturar quadrantes com um lado nulo
--    ("estudou sem fazer questão" / "vai mal e nunca estudou").
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_esforco_resultado
WITH (security_invoker=on) AS
SELECT
  COALESCE(t.user_id, d.user_id)                      AS user_id,
  COALESCE(t.eixo, d.eixo)                            AS eixo,
  COALESCE(t.no_id, d.no_id)                          AS no_id,
  COALESCE(t.no_nome, d.no_nome)                      AS no_nome,
  COALESCE(t.total_min, 0)                            AS total_min,
  COALESCE(t.n_sessoes, 0)                            AS n_sessoes,
  COALESCE(d.n_feitas, 0)                             AS n_feitas,
  COALESCE(d.n_acertos, 0)                            AS n_acertos,
  d.taxa                                              AS taxa,          -- NULL se sem questões
  (COALESCE(t.total_min,0) >= public.esforco_gate_tempo_min()) AS tempo_ok,
  COALESCE(d.amostra_suficiente, false)              AS questoes_ok,    -- gate ≥8 reusado
  -- padrão confiável: AMBOS os lados presentes E ambos os gates passados
  (t.user_id IS NOT NULL AND d.user_id IS NOT NULL
     AND COALESCE(t.total_min,0) >= public.esforco_gate_tempo_min()
     AND COALESCE(d.amostra_suficiente,false))        AS padrao_confiavel,
  now()                                               AS atualizado_em
FROM public.v_tempo_por_no t
FULL OUTER JOIN public.diag_por_no d
  ON  d.user_id = t.user_id
  AND d.eixo    = t.eixo
  AND d.no_id   = t.no_id;

COMMENT ON VIEW public.v_esforco_resultado IS
  'CRUZAMENTO esforço×resultado por nó. Gate DUPLO: tempo_ok (>=60min) E questoes_ok (>=8). '
  'padrao_confiavel só quando ambos lados presentes + ambos gates. FULL OUTER p/ ver quadrantes '
  'com lado nulo. Rótulo do quadrante fica no app (esforco.ts) — fato vs recomendação (§4).';

COMMIT;

-- =============================================================================
-- PÓS-MIGRATION (processo, não DDL):
--   supabase gen types typescript --local > src/lib/types/db.types.ts
--   (regenera tipos das 3 tabelas + 2 views; NÃO editar db.types.ts à mão)
-- =============================================================================
```

---

## 3. Algoritmo do gerador de cronograma

**Onde mora:** `src/lib/planner/cronograma.ts` (PURO, testável sem DB) — **reusa** `weaknessScore`/`ranquearNos` (`weakness-score.ts`), `gerarPlano` (`planner.ts`, para os blocos de questões), e constantes de `config.ts`. **Não modifica** nenhum desses arquivos (só importa).

**Saída:** `CronogramaBloco[]` → persistido em `cronograma_blocos` por uma Server Action.

### 3.1 Entrada

```ts
interface CronogramaInput {
  hoje: string;                  // ISO YYYY-MM-DD
  dataProva: string;             // '2026-09-06' (config)
  horasPorDia: number;           // horas/dia disponíveis (ou ver §3.5 p/ por-dia-da-semana)
  diasEstudo?: number[];         // weekdays 0..6 que ela estuda (default: todos)
  nos: NoDiagnostico[];          // universo de alvos = catálogo (materia/subtema) + stats do diag
  recentErros?: SubtemaBoost[];  // subtemas/matérias errados recentemente (repetição espaçada)
  cfg?: CronogramaConfig;        // defaults de config.ts
}
```

**Ponto crítico — cold start.** A Kamile está **começando**: ela tem pouca ou **zero** resposta. `diag_por_no` só devolve nós **com** respostas. Então a camada de dados (`cronograma.actions.ts`) faz o **merge**: pega o **catálogo inteiro** (matérias + subtemas, com `questoes_por_prova` = incidência) e sobrepõe os stats do diagnóstico onde existirem; nós sem histórico entram com `nFeitas=0`. O gerador puro recebe esse universo já mesclado. Isso garante que o cronograma **funciona com banco de respostas vazio** (ordena por incidência pura) e **fica mais fino** conforme ela responde questões.

### 3.2 Passo a passo

```
1. CALENDÁRIO
   diasEstudo = datas de hoje..dataProva que caem em diasEstudo[]  → N dias.
   orcamentoTotalMin = N * horasPorDia * 60.

2. PRIORIDADE POR NÓ (reusa ranquearNos)
   Para cada nó:
     score = weaknessScore(no)              // null se nFeitas < gate(8)
     peso  = (score !== null) ? score       // "reforço" — incidência×fraqueza×confiança
                              : no.pesoIncidencia   // "explorar/medir" — incidência pura (cold start)
   (o gate ≥8 é respeitado: abaixo dele NÃO se afirma fraqueza; usa-se incidência.)

3. DOSE GARANTIDA DE ÉTICA (regra ≥15% do edital — Ética/CED/DH/Filosofia)
   pisoEticaMin = max( cfg.pisoEticaFracao * orcamentoTotalMin,  // default 0.15
                       cfg.pisoEticaSemanalMin * nSemanas )
   reservado antes de distribuir o resto (alto ROI, conteúdo fechado).

4. ALOCAÇÃO DE MINUTOS
   restante = orcamentoTotalMin - pisoEticaMin
   minutosPorNo[no] = round( peso[no] / Σpeso * restante )   // proporcional ao peso

5. EXPANSÃO EM BLOCOS (interleaving conteúdo↔questões + repetição espaçada)
   Para cada nó-alvo com minutosPorNo > 0:
     - bloco CONTEUDO  (ler):    ~cfg.fracaoConteudo (default 0.6) dos minutos
     - bloco QUESTOES (praticar): ~0.4 dos minutos, agendado >=1 dia DEPOIS do conteúdo
       (minutos→questões via velocidadeQhDefault=30 q/h só p/ exibir a meta de questões)
     - se nó ∈ recentErros: blocos REVISAO curtos (~cfg.revisaoMin, 15-20min) em
       janelasEspacamento = [1,3,7] dias após o último contato (reusa config.ts)
   Ética: blocos pequenos distribuídos na maioria dos dias até consumir pisoEticaMin.

6. SEQUENCIAMENTO NO CALENDÁRIO
   Preenche dia a dia respeitando o budget diário (horasPorDia*60).
   Alterna conteudo↔questoes em dias consecutivos (interleaving real, não bloco gigante).
   Coloca a REVISAO espaçada na data-alvo calculada (passo 5).
   ordem = posição do bloco dentro do dia.

7. METADADOS
   origem='gerado', status='pendente', minutos_alvo=tamanho do bloco.
```

### 3.3 Reuso explícito (IDS — REUSE > CREATE)

| Peça reusada | De onde | Para quê no cronograma |
|--------------|---------|------------------------|
| `weaknessScore` / `ranquearNos` | `src/lib/diagnostico/weakness-score.ts` | prioridade incidência×fraqueza com gate ≥8 |
| `gerarPlano` | `src/lib/planner/planner.ts` | gerar a **dose de questões do dia** dentro de um bloco `questoes` (opcional, p/ casar com `plano_diario`) |
| `gateVolume, pisoEticaDiario, janelasEspacamento, velocidadeQhDefault, incidenciaMax, volumeConfiancaPlena` | `src/lib/planner/config.ts` | constantes; **estender** o arquivo com `cronograma` (ver §3.4) |

### 3.4 Novas constantes (APPEND em `config.ts` — não reescrever)

```ts
// --- Cronograma (Drop 1.5) ---
export const dataProva = "2026-09-06";          // restrição-mãe
export const minutosPorDiaDefault = 180;         // 3h/dia
export const fracaoConteudo = 0.6;               // 60% ler / 40% praticar por nó
export const pisoEticaFracao = 0.15;             // regra ≥15% do edital (Ética/CED/DH/Filosofia)
export const pisoEticaSemanalMin = 90;           // mínimo semanal de Ética (min)
export const revisaoMin = 20;                    // tamanho do bloco de revisão espaçada
export const gateTempoMin = 60;                  // espelha public.esforco_gate_tempo_min()
```

### 3.5 Decisões autônomas

- `[AUTO-DECISION]` **`horasPorDia` escalar vs por-dia-da-semana** → começar **escalar** (1 input, como o `plano-controls` de horas já faz). Por-dia-da-semana é refinamento de Fatia 2. (razão: menor superfície p/ a Kamile começar HOJE; o tipo já aceita evoluir.)
- `[AUTO-DECISION]` **questões dentro do bloco vêm de `gerarPlano`?** → no Fatia 1, o bloco `questoes` carrega apenas `minutos_alvo` + meta de questões (minutos×qph). Chamar `gerarPlano` para popular questões reais é **Fatia 2** (liga cronograma↔treino). (razão: evita acoplar o gerador de calendário ao runner de treino antes de a captura estar de pé.)
- `[AUTO-DECISION]` **grupo "Ética" inclui o quê** → matérias cujo nome casa Ética/Estatuto OAB, Direitos Humanos, Filosofia do Direito (mesma heurística de nome já usada em `planner.ts` para Ética). (razão: reusa o match existente; cobre a regra ≥15% do edital.)

---

## 4. Fluxo de UI (route group `(estudo)` — já existe)

O `(estudo)` já tem `layout.tsx`, `plano/` (planner de questões) e `treino/`. O Cockpit de Estudo **adiciona** duas áreas (Cronograma, Registro) e, na Fatia 2, uma de Progresso. Padrão de implementação **idêntico** ao `plano/`: `page.tsx` RSC carrega via Server Action → componente client interativo.

### (a) Cronograma / roteiro — `cronograma/`
- `page.tsx` **[RSC]** — carrega blocos de **hoje** e da **semana** (Server Action `carregarCronograma`), agrupados por `data_alvo`.
- `cronograma-view.tsx` **[client]** — lista os blocos marcáveis (`pendente → feito`), chamando `marcarBlocoFeito(blocoId, status)`. Visual por `tipo` (conteudo/questoes/revisao) e por matéria.
- `cronograma-controls.tsx` **[client]** — input de horas/dia (+ dias da semana na Fatia 2) → `gerarCronograma(horasPorDia)` (espelha `plano-controls.tsx`).

### (b) Registro de estudo — `registro/`  ← **coração da Fatia 1**
- `page.tsx` **[RSC]** — lista os últimos registros (`listarEstudoRecente`) + abre o form.
- `registro-form.tsx` **[client]** — **Fatia 1 = entrada MANUAL:** matéria (obrigatória) · subtema (opcional) · local (texto) · tipo_estudo · **minutos** · anotação → `registrarEstudo(...)` → cria `estudo_sessoes`. **Fatia 2 = timer** start/stop (estado local/Zustand) que calcula `duracao_min` + `inicio`/`fim`, **e** seletor de `material_id` (catálogo).

### (c) Stat básico "tempo por matéria" — Fatia 2
- `progresso/page.tsx` **[RSC]** — lê `v_tempo_por_no` (eixo=`materia`) → barras de tempo por matéria (Recharts, já na stack). Mais adiante (Drop 2): superfície de `v_esforco_resultado` (quadrantes esforço×resultado).

### (d) Navegação — extensão de `(estudo)/layout.tsx`
Adicionar links **Plano · Cronograma · Registro · (Progresso)** no header existente. **Extensão aditiva** (baixo risco de conflito).

---

## 5. FATIAMENTO (para velocidade)

> A migration de schema (§2.4) entra **inteira** na Fatia 1 (é a fundação; FKs entre as 3 tabelas). O fatiamento abaixo governa o **código/UI do @dev**.

### FATIA 1 — "a Kamile estuda + registra HOJE" (mínimo viável do sensor + roteiro)

**Objetivo:** ela abre o app, vê um **roteiro do dia/semana** e consegue **registrar tempo manualmente**. Captura de dado ligada.

| Entregável | Arquivos |
|------------|----------|
| Migration completa (3 tabelas + 2 views + gate) | `supabase/migrations/20260626120000_study_cockpit.sql` + `supabase gen types` |
| Tipos de domínio | APPEND em `src/lib/types/domain.ts` (`EstudoSessao`, `CronogramaBloco`, `TipoEstudo`, enums) |
| Constantes do cronograma | APPEND em `src/lib/planner/config.ts` (§3.4) |
| Gerador puro | `src/lib/planner/cronograma.ts` (+ teste unit) |
| Server Actions estudo | `src/app/(estudo)/_actions/estudo.actions.ts` (`registrarEstudo`, `listarEstudoRecente`) |
| Server Actions cronograma | `src/app/(estudo)/_actions/cronograma.actions.ts` (`gerarCronograma`, `carregarCronograma`, `marcarBlocoFeito`) |
| UI registro (MANUAL) | `src/app/(estudo)/registro/page.tsx` + `registro-form.tsx` |
| UI cronograma (visível + marcável) | `src/app/(estudo)/cronograma/page.tsx` + `cronograma-view.tsx` + `cronograma-controls.tsx` |
| Nav | EXTEND `src/app/(estudo)/layout.tsx` |

**Fora da Fatia 1 (explicitamente):** timer, catálogo de materiais, `material_id` no form, stat de tempo, view de esforço na tela. `v_esforco_resultado` **existe no banco** (a captura precisa dele acumulando), mas **não tem tela** na Fatia 1.

### FATIA 2 — "fica rico"

| Entregável | Arquivos |
|------------|----------|
| Catálogo de materiais (CRUD) + `material_id` no registro | `src/app/(estudo)/materiais/page.tsx` + form; editar `registro-form.tsx` |
| Timer start/stop (calcula `duracao_min`+`inicio`/`fim`) | editar `registro-form.tsx` (estado local/Zustand) |
| Stat "tempo por matéria" | `src/app/(estudo)/progresso/page.tsx` (lê `v_tempo_por_no`) |
| Cronograma por-dia-da-semana + ligação bloco→treino | editar `cronograma-controls.tsx` + `cronograma.ts` |

### DROP 2 (depois da prova de captura)
- Tela de `v_esforco_resultado` (quadrantes) + classificador `src/lib/diagnostico/esforco.ts` (rótulo só com `padrao_confiavel`).

---

## 6. Pedidos ao @data-engineer (Dara) — DDL

O DDL completo está no §2.4 (copiar/colar como `20260626120000_study_cockpit.sql`). Pontos de atenção:

- **E-1 (aditivo absoluto):** só `CREATE`. **Nenhum** `ALTER`/`DROP` em objeto existente. Validar que aplicar em cima do schema atual (`...130000`) não toca `sessoes`/`respostas`/`diag_*`/`questoes_prova`.
- **E-2 (`duracao_min` real, não GENERATED):** intencional — entrada manual não tem `inicio`/`fim`. Manter `NOT NULL CHECK > 0`. (Opcional, à sua escolha: trigger BEFORE INSERT que preenche `duracao_min` de `(fim-inicio)/60` **quando** vier NULL e ambos presentes — não é necessário p/ Fatia 1.)
- **E-3 (RLS espelhada):** as 3 tabelas seguem **exatamente** o padrão de `120002` (ENABLE+FORCE + policies `_select/_insert/_update/_delete_own`, `auth.uid()=user_id`). `user_id` é direto → **sem** trigger de sync (diferente de `respostas`).
- **E-4 (gate duplo):** criar `public.esforco_gate_tempo_min()` (default 60) como single source of truth, espelhando `diag_gate_minimo()`. `v_esforco_resultado` reusa `diag_gate_minimo()` para o lado das questões.
- **E-5 (views `security_invoker=on`):** ambas as views novas, como todas as views da casa (D-6). Elas herdam a RLS das tabelas-base (`estudo_sessoes`, `diag_por_no`).
- **E-6 (`FULL OUTER JOIN` proposital):** em `v_esforco_resultado`, **não** trocar por INNER — precisamos dos quadrantes com lado nulo. COALESCE das chaves já tratado no DDL.
- **E-7 (índices):** confirmados no §5 do DDL (agregação de tempo por nó + leitura do cronograma por dia/status).
- **E-8 (regen de tipos):** após `supabase db push`, rodar `supabase gen types typescript --local > src/lib/types/db.types.ts` (D-9 da casa). Não editar `db.types.ts` à mão.
- **⚠️ E-9 (drift pré-existente para registrar, não corrigir agora):** `src/lib/diagnostico/queries.ts` referencia views `v_diagnostico_conteudo`/`v_diagnostico_dimensao`/`v_diagnostico_cross` que **não existem** (as reais são `diag_por_no`/`diag_cross_subtema_dimensao`). O cruzamento novo usa a view **real `diag_por_no`**. Sinalizo para alinhamento do time (correção é fora do escopo desta migration).

---

## 7. Pedidos ao @dev (Dex) — arquivos e limites (evitar conflito)

**Regra de ouro:** **NÃO tocar no pilar de questões.** Tudo abaixo é novo ou extensão aditiva. Importar de `planner`/`diagnostico`, nunca modificá-los.

### Arquivos NOVOS (zero conflito)
```
src/lib/planner/cronograma.ts                       # gerador puro (§3) + teste
src/app/(estudo)/_actions/estudo.actions.ts         # registrarEstudo, listarEstudoRecente
src/app/(estudo)/_actions/cronograma.actions.ts     # gerarCronograma, carregarCronograma, marcarBlocoFeito
src/app/(estudo)/registro/page.tsx                  # RSC
src/app/(estudo)/registro/registro-form.tsx         # client (Fatia 1: manual)
src/app/(estudo)/cronograma/page.tsx                # RSC
src/app/(estudo)/cronograma/cronograma-view.tsx     # client (marcar feito)
src/app/(estudo)/cronograma/cronograma-controls.tsx # client (gerar/regenerar)
tests/unit/cronograma.test.ts                       # Vitest (puro)
# Fatia 2: src/app/(estudo)/materiais/* , src/app/(estudo)/progresso/page.tsx
# Drop 2: src/lib/diagnostico/esforco.ts
```

### Arquivos EXTENDIDOS (append-only — baixo risco)
```
src/lib/planner/config.ts        # APPEND bloco "Cronograma" (§3.4). NÃO alterar constantes existentes.
src/lib/types/domain.ts          # APPEND interfaces novas. NÃO alterar as existentes.
src/app/(estudo)/layout.tsx      # ADD links de nav (Plano·Cronograma·Registro). NÃO refatorar.
```

### NÃO TOCAR (fronteira)
```
src/lib/planner/planner.ts                 # reusar via import; é lei validada
src/lib/diagnostico/*                       # reusar; v_esforco_resultado lê diag_por_no
src/app/(teste)/* , src/app/(verificacao)/* # pilar de questões + gabarito
src/lib/correcao/* , supabase/migrations/2026062*  # já aplicadas
src/lib/types/db.types.ts                   # gerado pelo supabase gen types (não editar à mão)
```

### Contratos das Server Actions (forma `{ ok, ... }` — padrão da casa)
```ts
// estudo.actions.ts
registrarEstudo(input: {
  materiaId: string; subtemaId?: string; microTopicoId?: string;
  materialId?: string; local?: string; tipoEstudo: TipoEstudo;
  minutos: number; anotacao?: string; inicio?: string; fim?: string;
}): Promise<{ ok: true; id: string } | { ok: false; erro: string }>;
listarEstudoRecente(limit?: number): Promise<EstudoSessao[]>;

// cronograma.actions.ts
gerarCronograma(horasPorDia: number): Promise<{ ok: true; blocos: CronogramaBloco[] } | { ok: false; erro: string }>;
carregarCronograma(range: "hoje" | "semana"): Promise<CronogramaBloco[]>;
marcarBlocoFeito(blocoId: string, status: BlocoStatus): Promise<{ ok: true } | { ok: false; erro: string }>;
```

**Implementação obrigatória nas actions:**
- **Validação de input com Zod** na fronteira server (padrão da casa) — `minutos > 0`, `materiaId` é UUID válido, enums fechados.
- **`auth.getUser()`** e `user_id = user.id` em todo insert (RLS exige; espelha `planner.actions.ts`).
- **Re-geração não destrói histórico:** `gerarCronograma` faz `DELETE ... WHERE origem='gerado' AND status='pendente' AND data_alvo >= hoje`, depois insere os novos. **Preserva** `feito`, `em_andamento`, `manual` e pendentes passados.
- **Merge cold-start** (§3.1): a action busca catálogo (`materias`+`subtemas`) **e** `diag_por_no`, mescla (nós sem histórico → `nFeitas=0`), e passa o universo ao gerador puro.

---

## 8. Trade-offs, segurança e compatibilidade

### Trade-offs decididos
| Decisão | Alternativa | Por que esta |
|---------|-------------|--------------|
| `estudo_sessoes` log **plano** | tabela pai+filhos como `sessoes`/`respostas` | 1 evento = 1 linha é a granularidade do sensor; pai/filho é cerimônia sem payoff p/ time-tracking. |
| `duracao_min` real | `GENERATED` de `inicio/fim` | entrada manual (Fatia 1) não tem início/fim — GENERATED quebraria a captura. |
| `v_esforco_resultado` reusa `diag_por_no` | recalcular acerto na view nova | DRY + uma só fonte de taxa; o gate ≥8 já vem pronto de lá. |
| Cronograma = **1 migration + UI fatiada** | migration por fatia | FKs entre as 3 tabelas exigem aplicação atômica; fatiar SQL criaria estado intermediário inválido. |
| `v_esforco_resultado` no banco já na Fatia 1 (sem tela) | criar só no Drop 2 | a captura precisa dele **acumulando**; SQL é barato; tela é que é Drop 2. |

### Segurança (flags)
- **Sem superfície de gabarito.** O pilar de estudo **não toca** `questoes.gabarito` nem o fluxo de prova — a fronteira de segurança nº1 permanece intacta.
- **Dados 100% da usuária** → RLS `auth.uid()=user_id` em todas as 3 tabelas (espelha `sessoes`). `FORCE ROW LEVEL SECURITY` ligado.
- **Free text** (`anotacao`, `local`, `materiais.referencia`): renderizar como **texto** (React escapa por padrão — **nunca** `dangerouslySetInnerHTML`). Se `referencia` virar link clicável, **validar o scheme** (só `http(s)`, bloquear `javascript:`).
- **Validação Zod** obrigatória nas Server Actions (input não confiável na fronteira).

### Compatibilidade (backward)
- **Aditivo puro.** Rollback = `DROP` das 3 tabelas + 2 views + 1 função + 5 enums; o pilar de questões fica idêntico.
- **Local→cloud sem retrabalho:** mesma migration roda no Supabase da Kamile no deploy (`supabase db push`), como toda a estratégia local-first.
- **Multi-user ready:** `user_id` em tudo; virar multi-user = zero mudança de schema (D-01).

---

## 9. Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-06-26 | v1.0 | Design do Cockpit de Estudo (Drop 1.5): schema aditivo (`materiais`, `estudo_sessoes`, `cronograma_blocos` + views `v_tempo_por_no`, `v_esforco_resultado` com gate duplo); gerador de cronograma puro reusando `lib/planner`; fluxo de UI no `(estudo)`; Fatia 1 (sensor+roteiro manual) vs Fatia 2 (timer/materiais/stat); pedidos ao @data-engineer (DDL pronto) e ao @dev (arquivos/limites). | Aria (@architect) |
