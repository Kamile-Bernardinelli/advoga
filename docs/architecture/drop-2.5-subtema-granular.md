# Drop 2.5 — Cronograma Subtema-Granular + Loop de Desempenho

> **Architect:** Aria (@architect) · **Data:** 2026-06-27 · **Status:** IMPLEMENTATION-READY (para @dev)
> **Princípio-mãe:** data-driven, nunca achismo. Subtema priorizado por **incidência real OAB** (COUNT de questões nos exames ingeridos) × **desempenho dela** (diag eixo='subtema'), com gate anti-chute ≥8.
> **Restrição-mãe:** prova 06/09/2026 — escopo cirúrgico, reusa os planners eixo-agnósticos, migrations aditivas.

---

## 0. TL;DR da arquitetura

A Kamile já tem TODA a maquinaria certa; o Drop 2.5 só **alimenta os planners com nós de subtema** em vez de matéria, e **fecha o loop de questões** reusando o runner de prova existente.

```
v_incidencia_subtema (NOVO, fato: COUNT questões/subtema)
        │  pesoIncidencia = n_questoes
        ▼
cronograma.actions.ts ──merge──► NoDiagnostico[] (eixo='subtema')
        ▲                              │
        │  performance dela            ▼
diag_por_no (eixo='subtema') ◄─┐  gerarCronograma()  [PURO, já eixo-agnóstico]
        ▲                      │       │
        │ (correta NOT NULL)   │       ▼  blocos eixo='subtema' (conteúdo→questões)
v_respostas_corrigidas         │  cronograma_blocos (subtema_id + materia_id)
        ▲                      │       │
        │                      │       ▼  /plano + /cronograma  "Matéria › Subtema"
   finalizeSession ◄───────────┘       │
   (corrigir_sessao)                   ▼  bloco "questões" → /treino?subtema=ID
        ▲                              │
        └──── sessão treino ◄──────────┘  (runner /teste/[id] reusado, gabarito-safe)
                  LOOP FECHADO: responde → diag recalcula → próximo gerarCronograma re-prioriza
```

**Insight central:** os planners (`cronograma.ts`, `planner.ts`) **já carregam `eixo` + `noId` em cada bloco** e fazem priorização incidência×fraqueza sobre `NoDiagnostico[]` genérico. A view `diag_por_no` **já tem a CTE de subtema completa**. O runner `/teste/[sessaoId]` **já lê só de `questoes_prova` (sem gabarito)**. A página de resultado **já agrega por subtema com badge "amostra insuficiente (<8)"**. Falta apenas: (1) a view de incidência de subtema, (2) trocar a fonte de nós na action, (3) persistir os 2 IDs, (4) detectar Ética por matéria-pai, (5) deep-link do bloco de questões para um treino filtrado por subtema (+1 coluna em `sessoes`).

### Decisões travadas (não redecidir)

| # | Decisão | Justificativa |
|---|---------|---------------|
| D-A | **Incidência = COUNT bruto** de questões por subtema (não normalizado em SQL) | `weaknessScore` já normaliza (`incid/incidenciaMax`) e a alocação do cronograma é **proporcional** (scale-invariant). Normalizar no SQL seria dupla-normalização. Fato cru no SQL, calibração no app (padrão da casa). |
| D-B | **Cronograma gera blocos de SUBTEMA**; matéria vira **fallback** só p/ matérias sem subtema cobrado | É o pedido da Kamile. Fallback preserva capacidade (nenhuma matéria some). |
| D-C | **Ética por matéria-pai**, não por nome do nó | Subtemas de Ética ("Honorários", "CED") não casam `ETICA_RE`. Flag `eEtica` no nó, setada pela action via nome da matéria-pai. |
| D-D | **Loop reusa o runner `/teste/[sessaoId]`** + `questoes_prova` + `corrigir_sessao` | Zero duplicação; herda a fronteira de segurança do gabarito automaticamente. Custo: 1 coluna aditiva `sessoes.subtema_id`. |
| D-E | `incidenciaMax` **continua 20** (não recalibrar p/ subtema) | Alocação é relativa; escalar uniforme não muda ranking nem proporções. Evita migration de calibração. |
| D-F | `planner.actions.ts` (`gerarPlano`/`plano_diario`) **fica matéria-level no 2.5** | O loop real roda pelo cronograma+treino. Subtema no plano diário = parking lot (não acelera o DoD). Caminho opcional documentado em §7.4. |

---

## 1. Incidence view DDL

### Migration (aditiva, idempotente)

**Arquivo:** `supabase/migrations/20260627120000_incidencia_subtema.sql`

```sql
-- =============================================================================
-- Advoga — Drop 2.5: Incidência de subtema (fato: COUNT de questões/subtema)
-- Migration: 20260627120000_incidencia_subtema.sql
-- Author: Dara (@data-engineer) · Design: Aria (@architect)
-- Depends on: 20260621120000 (subtemas/materias/questoes), 120003 (questoes_prova)
-- =============================================================================
-- PURPOSE
--   Sinal de PRIORIZAÇÃO por subtema: quantas questões de cada subtema caíram
--   nos exames ingeridos. É o equivalente de materias.questoes_por_prova, mas
--   COMPUTADO (sem coluna manual): COUNT(questoes) por subtema.
--
--   n_questoes      = incidência histórica (TODAS as questões do subtema) → pesoIncidencia
--   n_disponiveis   = subconjunto respondível AGORA (validade vigente|em_revisao,
--                     espelha questoes_prova) → honestidade do loop (treino vazio?)
--
-- ANTI-CHUTE: este é um FATO do corpus (não da usuária, sem user_id). A priorização
--   por fraqueza entra DEPOIS, no merge com diag_por_no (eixo='subtema'), no app.
-- ADITIVO: CREATE OR REPLACE VIEW; nenhum ALTER/DROP. Seguro re-rodar.
-- =============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_incidencia_subtema
WITH (security_invoker=on) AS
SELECT
  s.id                                            AS subtema_id,
  s.nome                                          AS subtema_nome,
  s.materia_id                                    AS materia_id,
  m.nome                                          AS materia_nome,
  count(q.id)                                     AS n_questoes,       -- incidência (todas)
  count(q.id) FILTER (
    WHERE q.validade_status IN ('vigente', 'em_revisao')
  )                                               AS n_disponiveis,    -- respondíveis agora
  now()                                           AS atualizado_em
FROM public.subtemas s
JOIN public.materias m ON m.id = s.materia_id
JOIN public.questoes q ON q.subtema_id = s.id     -- INNER: só subtemas COBRADOS (incidência>0)
GROUP BY s.id, s.nome, s.materia_id, m.nome;

COMMENT ON VIEW public.v_incidencia_subtema IS
  'Drop 2.5: incidência de subtema = COUNT(questoes) por subtema (fato do corpus, sem user_id). '
  'n_questoes = pesoIncidencia do planner; n_disponiveis = respondíveis (espelha questoes_prova). '
  'INNER JOIN questoes → só subtemas cobrados. security_invoker=on (padrão D-6).';

COMMIT;

-- =============================================================================
-- PÓS-MIGRATION (processo, não DDL):
--   supabase gen types typescript --local > src/lib/types/db.types.ts
--   (adiciona a Row de v_incidencia_subtema; NÃO editar db.types.ts à mão)
-- =============================================================================
```

**Notas de design:**
- **`security_invoker=on`** — padrão da casa (igual `questoes_prova`, `diag_por_no`, `v_tempo_por_no`). `subtemas`/`materias`/`questoes` são catálogo (sem RLS user-scoped); authenticated lê normalmente.
- **Sem `user_id`** — incidência é propriedade do corpus de exames, igual para todos. O merge user-scoped acontece no app contra `diag_por_no`.
- **`n_questoes` cru (D-A)** — não dividir/normalizar. Top subtemas hoje: 7–14; média 4,1; 158/192 cobertos. Cauda fina será adensada no Drop 3 (backfill). O gate ≥8 garante que a cauda fina fique em modo incidência-pura até ter amostra.
- **Índice:** opcional. Com 640 questões o full-scan agregado é trivial. Se @dev quiser higiene, `CREATE INDEX IF NOT EXISTS idx_questoes_subtema ON public.questoes(subtema_id);` (verificar antes que não exista sob outro nome no init_schema).

---

## 2. Mudanças exatas por arquivo

### 2.1 `src/lib/types/domain.ts` — +1 campo opcional em `NoDiagnostico`

> **Correção da recon:** a recon afirma que `NoDiagnostico` já tem `subtemaId/subtemaNome/materiaNome`. **Não tem** (linhas 4–13 só têm noId/noNome/eixo/nFeitas/nAcertos/taxa/pesoIncidencia/volumeOk). Só `CronogramaBloco` tem os campos de display. A única adição NECESSÁRIA é `eEtica`.

```ts
export interface NoDiagnostico {
  noId: string;
  noNome: string;
  eixo: string;
  nFeitas: number;
  nAcertos: number;
  taxa: number;
  pesoIncidencia: number;
  volumeOk: boolean;
  /** Drop 2.5: nó pertence ao bloco de Ética (≥15% do edital). Em subtemas é
   *  setado pela action via matéria-pai (o nome do subtema não casa ETICA_RE).
   *  Opcional → backward-compat: matéria-level continua caindo no ETICA_RE por nome. */
  eEtica?: boolean;
}
```

Nenhum outro tipo muda. `CronogramaBloco` já tem `materiaNome?`/`subtemaNome?`.

---

### 2.2 `src/lib/planner/cronograma.ts` — detecção de Ética aditiva (puro, mínimo)

Duas mudanças cirúrgicas. **Não tocar** o algoritmo de alocação/sequenciamento (já é eixo-agnóstico: cada bloco carrega `eixo` + `noId`).

**(a)** Exportar helper (mantém `ETICA_RE` single-source), logo após a definição da regex (linha ~84):

```ts
/** Regex para identificar matérias de Ética/CED/DH/Filosofia (padrão da casa de planner.ts). */
const ETICA_RE = /ética|estatuto.*oab|direitos.humanos|filosofia.do.direito/i;

/** Drop 2.5: a action usa isto sobre o NOME DA MATÉRIA-PAI p/ marcar subtemas de Ética. */
export function nomeEhEtica(nome: string): boolean {
  return ETICA_RE.test(nome);
}
```

**(b)** Trocar o split de Ética (linhas 184–185) para respeitar a flag `eEtica`:

```ts
// ANTES:
//   const nosEtica = input.nos.filter((n) => ETICA_RE.test(n.noNome));
//   const nosRest  = input.nos.filter((n) => !ETICA_RE.test(n.noNome));

// DEPOIS — flag explícita (subtema) com fallback p/ nome (matéria), backward-compat:
const isEtica = (n: NoDiagnostico): boolean => n.eEtica ?? ETICA_RE.test(n.noNome);
const nosEtica = input.nos.filter(isEtica);
const nosRest  = input.nos.filter((n) => !isEtica(n));
```

A matemática da dose de Ética (`pisoEticaMin`, distribuição proporcional entre `nosEticaComPeso`) **não muda** — é agnóstica de granularidade (opera sobre minutos × nós, sejam matérias ou subtemas). Ver §3 e §9.3.

---

### 2.3 `src/app/(estudo)/_actions/cronograma.actions.ts` — fonte de nós = subtema

Esta é a mudança central. Substituir a montagem matéria-level por subtema-level (com fallback de matéria). Os helpers de metas/override (§4.3 v2) **permanecem intactos** — só muda como `nos` é construído e como os blocos são persistidos.

#### 2.3.1 Novos tipos raw + fetch

```ts
// --- Raw rows (adicionar perto dos demais RawXxx) ---
interface RawIncidenciaSubtema {
  subtema_id: string;
  subtema_nome: string;
  materia_id: string;
  materia_nome: string;
  n_questoes: number;
  n_disponiveis: number;
}

interface RawDiagSubtema {
  no_id: string | null;        // = subtema_id::text
  n_feitas: number | null;
  n_acertos: number | null;
  taxa: number | null;
  amostra_suficiente: boolean | null;
}

/** Incidência de subtema (fato do corpus — sem user_id). Universo de subtemas COBRADOS. */
async function fetchIncidenciaSubtema(
  client: Awaited<ReturnType<typeof createActionClient>>
): Promise<RawIncidenciaSubtema[]> {
  const { data, error } = await client
    .from("v_incidencia_subtema")
    .select("subtema_id, subtema_nome, materia_id, materia_nome, n_questoes, n_disponiveis");
  if (error) throw new Error(`fetchIncidenciaSubtema: ${error.message}`);
  return (data ?? []) as RawIncidenciaSubtema[];
}

/** Desempenho da usuária por subtema (cold-start = []). */
async function fetchDiagSubtema(
  client: Awaited<ReturnType<typeof createActionClient>>,
  userId: string
): Promise<RawDiagSubtema[]> {
  const { data, error } = await client
    .from("diag_por_no")
    .select("no_id, n_feitas, n_acertos, taxa, amostra_suficiente")
    .eq("user_id", userId)
    .eq("eixo", "subtema");
  if (error) throw new Error(`fetchDiagSubtema: ${error.message}`);
  return (data ?? []) as RawDiagSubtema[];
}
```

#### 2.3.2 Merge subtema (incidência × desempenho) + mapa subtema→matéria

```ts
import { nomeEhEtica } from "@/lib/planner/cronograma";

/**
 * Constrói NoDiagnostico[] de subtema (universo = subtemas cobrados) e o mapa
 * subtema_id → materia_id (p/ persistir materia_id, que é NOT NULL na tabela).
 * Cold-start: subtema sem histórico entra com nFeitas=0 → incidência pura.
 */
function buildSubtemaNos(
  incidencia: RawIncidenciaSubtema[],
  diag: RawDiagSubtema[]
): { nos: NoDiagnostico[]; subtemaParent: Map<string, string>; materiasComSubtema: Set<string> } {
  const diagMap = new Map<string, RawDiagSubtema>(
    diag.filter((d) => d.no_id).map((d) => [d.no_id!, d])
  );
  const subtemaParent = new Map<string, string>();
  const materiasComSubtema = new Set<string>();

  const nos: NoDiagnostico[] = incidencia.map((inc) => {
    const d = diagMap.get(inc.subtema_id);
    subtemaParent.set(inc.subtema_id, inc.materia_id);
    materiasComSubtema.add(inc.materia_id);
    return {
      noId:           inc.subtema_id,
      noNome:         inc.subtema_nome,
      eixo:           "subtema",
      nFeitas:        d?.n_feitas  ?? 0,
      nAcertos:       d?.n_acertos ?? 0,
      taxa:           Number(d?.taxa ?? 0),
      pesoIncidencia: inc.n_questoes,                  // D-A: COUNT bruto
      volumeOk:       d?.amostra_suficiente ?? false,
      eEtica:         nomeEhEtica(inc.materia_nome),   // D-C: por matéria-pai
    };
  });

  return { nos, subtemaParent, materiasComSubtema };
}
```

#### 2.3.3 Fallback de matéria (D-B) — matérias SEM subtema cobrado

Reusa o `mergeNos` + `fetchDiagMateria` existentes; só filtra as matérias que **não** aparecem no universo de subtemas, e marca `eEtica` por nome.

```ts
/** Matérias sem nenhum subtema cobrado → nós matéria-level (capability preservation). */
function buildFallbackMateriaNos(
  materias: RawMateria[],
  diagMateria: RawDiagNo[],
  materiasComSubtema: Set<string>
): NoDiagnostico[] {
  const semSubtema = materias.filter((m) => !materiasComSubtema.has(m.id));
  return mergeNos(semSubtema, diagMateria).map((n) => ({
    ...n,
    eEtica: nomeEhEtica(n.noNome),   // nome da própria matéria
  }));
}
```

#### 2.3.4 `gerarCronograma` — montagem de nós + persistência branchada

Trocar o trecho de fetch/merge (linhas ~219–227) e o trecho de INSERT (linhas ~296–316):

```ts
// --- 1. Fetches em paralelo: incidência subtema + diag subtema + catálogo + diag matéria ---
const [incidencia, diagSubtema, materias, diagMateria] = await Promise.all([
  fetchIncidenciaSubtema(client),
  fetchDiagSubtema(client, userId),
  fetchMaterias(client),
  fetchDiagMateria(client, userId),
]);

// --- 2. Nós de subtema (primários) + fallback de matéria (sem subtema cobrado) ---
const { nos: subtemaNos, subtemaParent, materiasComSubtema } =
  buildSubtemaNos(incidencia, diagSubtema);
const fallbackNos = buildFallbackMateriaNos(materias, diagMateria, materiasComSubtema);
const nos: NoDiagnostico[] = [...subtemaNos, ...fallbackNos];
```

```ts
// --- 5. INSERT novos blocos: branch eixo='subtema' vs 'materia' ---
if (blocosGerados.length > 0) {
  const rows = blocosGerados
    .map((b) => {
      const base = {
        user_id:      userId,
        data_alvo:    b.dataAlvo,
        tipo:         b.tipo,
        minutos_alvo: b.minutosAlvo,
        ordem:        b.ordem,
        status:       "pendente" as const,
        origem:       "gerado"  as const,
      };
      if (b.eixo === "subtema") {
        const materiaId = subtemaParent.get(b.noId);
        if (!materiaId) return null;                 // guard: FK garante que não ocorre
        return { ...base, materia_id: materiaId, subtema_id: b.noId };
      }
      // fallback matéria
      return { ...base, materia_id: b.noId, subtema_id: null as string | null };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error: insErr } = await client.from("cronograma_blocos").insert(rows);
  if (insErr) {
    return { ok: false, erro: `Erro ao salvar blocos: ${insErr.message}` };
  }
}
```

> O resto de `gerarCronograma` (Zod, auth, metas/override, DELETE preserve-rule, revalidate) **não muda**. `calcularBlocos({ ..., nos })` recebe os nós mistos; o gerador puro já lida com `eixo` heterogêneo.

#### 2.3.5 (Recomendado) Revisão espaçada por subtema — fecha o loop de revisão

`gerarCronograma` hoje **não passa** `recentErros`. Para a revisão espaçada operar por subtema, adicionar:

```ts
/** Subtemas errados nas últimas 2 sessões finalizadas → blocos de revisão [1,3,7] dias. */
async function fetchSubtemaErradosRecentes(
  client: Awaited<ReturnType<typeof createActionClient>>,
  userId: string
): Promise<{ noId: string; multiplicador: number }[]> {
  const { data: sessoes } = await client
    .from("sessoes").select("id").eq("user_id", userId)
    .not("fim", "is", null).order("inicio", { ascending: false }).limit(2);
  if (!sessoes?.length) return [];
  const { data: erradas } = await client
    .from("respostas")
    .select("subtema_id:questoes(subtema_id)")
    .in("sessao_id", sessoes.map((s) => s.id as string))
    .eq("correta", false);
  const ids = new Set<string>();
  for (const r of (erradas ?? []) as unknown as { subtema_id: string | null }[]) {
    if (r.subtema_id) ids.add(r.subtema_id);
  }
  return Array.from(ids).map((noId) => ({ noId, multiplicador: 1.2 }));
}
```

E passar no `calcularBlocos({ ..., nos, recentErros: await fetchSubtemaErradosRecentes(client, userId) })`. (`cronograma.ts` usa só o `Set` de `noId` p/ emitir blocos de revisão — ver linhas 356–366; o `multiplicador` é ignorado lá, então qualquer valor serve.)

---

### 2.4 `_carregarBlocos` (mesmo arquivo) — join de `subtemas` na leitura

A leitura hoje só faz `materias:materia_id(nome)`. Adicionar `subtemas:subtema_id(nome)`.

**RawBlocoRow** (linha ~63): adicionar
```ts
  subtemas: { nome: string } | null;
```

**SELECT** em `_carregarBlocos` (linhas ~166–171):
```ts
.select(
  "id, user_id, data_alvo, materia_id, subtema_id, tipo, minutos_alvo, " +
  "status, ordem, origem, created_at, updated_at, " +
  "materias:materia_id(nome), subtemas:subtema_id(nome)"
)
```

**`rowToBloco`** (linha ~149) — preencher `subtemaNome`:
```ts
materiaNome: row.materias?.nome ?? undefined,
subtemaNome: row.subtemas?.nome ?? undefined,
```

---

### 2.5 UI — `/cronograma` e `/plano` mostram "Matéria › Subtema"

Ambos os `BlocoCard` já leem `materiaNome`/`subtemaNome`; só precisam exibir como breadcrumb (subtema é o foco, matéria é o contexto).

**`src/app/(estudo)/cronograma/cronograma-view.tsx`** — bloco do conteúdo (linhas 80–87):
```tsx
<div className="min-w-0">
  {bloco.subtemaNome ? (
    <>
      <p className="text-xs text-gray-400 truncate">{bloco.materiaNome ?? "Matéria"} ›</p>
      <p className={`text-sm font-medium truncate ${isFeito ? "line-through text-gray-400" : "text-gray-900"}`}>
        {bloco.subtemaNome}
      </p>
    </>
  ) : (
    <p className={`text-sm font-medium truncate ${isFeito ? "line-through text-gray-400" : "text-gray-900"}`}>
      {bloco.materiaNome ?? bloco.materiaId}
    </p>
  )}
</div>
```

E (loop) link de questões no `BlocoCard` do cronograma-view — adicionar dentro da `<div className="min-w-0">`, após o nome, quando `tipo==='questoes'`:
```tsx
{bloco.tipo === "questoes" && bloco.subtemaId && (
  <a
    href={`/treino?subtema=${bloco.subtemaId}`}
    className="inline-block mt-1 text-xs text-purple-700 underline underline-offset-2 hover:text-purple-900"
  >
    Treinar questões
  </a>
)}
```

**`src/app/(estudo)/plano/plano-do-dia.tsx`** — nome do bloco (linhas 251–256):
```tsx
{bloco.subtemaNome ? (
  <>
    <p className="text-xs text-gray-400">{bloco.materiaNome ?? "Matéria"} ›</p>
    <p className="font-medium text-gray-900 text-sm">{bloco.subtemaNome}</p>
  </>
) : (
  <p className="font-medium text-gray-900 text-sm">
    {bloco.materiaNome ?? bloco.materiaId.slice(0, 8)}
  </p>
)}
```

E o link de questões existente (linhas 259–266) — passar o subtema:
```tsx
{bloco.tipo === "questoes" && (
  <Link
    href={bloco.subtemaId ? `/treino?subtema=${bloco.subtemaId}` : "/treino"}
    className="inline-block mt-2 text-xs text-purple-700 underline underline-offset-2 hover:text-purple-900"
  >
    {bloco.subtemaNome ? "Treinar questões deste subtema" : "Ir para treino de questões"}
  </Link>
)}
```

---

## 3. Ética no nível de subtema (D-C)

**Problema:** `ETICA_RE` casa o NOME do nó. Subtemas de Ética ("Honorários advocatícios", "Infrações disciplinares", "Sociedade de advogados") **não** contêm "ética/estatuto/direitos humanos/filosofia" — só a matéria-PAI casa (Ética e Estatuto da OAB / Código de Ética / Direitos Humanos / Filosofia do Direito).

**Solução (mínima, aditiva):**
1. A action calcula `eEtica = nomeEhEtica(materia_nome)` ao montar cada nó de subtema (§2.3.2) — `nomeEhEtica` reusa a MESMA `ETICA_RE` exportada de `cronograma.ts` (single-source, sem duplicar regex).
2. `cronograma.ts` separa Ética por `n.eEtica ?? ETICA_RE.test(n.noNome)` (§2.2b) — flag para subtema, nome para matéria-fallback. Backward-compat total.

**Math da dose (inalterada, granularidade-agnóstica):**
- `pisoEticaMin = max(0.15 × orçamentoTotal, 90min × nSemanas)` — minutos.
- Distribuídos proporcionalmente entre os **nós de Ética que existirem** (subtemas de Ética cobrados, ou a matéria-fallback de Ética se ela não tiver subtema cobrado).
- Como a dose é por MINUTOS sobre o conjunto de nós Ética, funciona idêntica em qualquer granularidade. Subtemas de Ética concorrem entre si pela fatia de 15%, ranqueados por incidência×fraqueza (igual aos demais).

---

## 4. O loop de desempenho (D-D)

### 4.1 Migration — `sessoes.subtema_id` (1 coluna aditiva)

**Arquivo:** `supabase/migrations/20260627120001_sessao_subtema_treino.sql`

```sql
-- =============================================================================
-- Advoga — Drop 2.5: sessão de treino escopada por subtema (loop de desempenho)
-- Migration: 20260627120001_sessao_subtema_treino.sql
-- Depends on: 20260621120000 (sessoes, subtemas)
-- ADITIVO: ADD COLUMN IF NOT EXISTS; nenhum ALTER destrutivo. RLS de sessoes já cobre.
-- =============================================================================
BEGIN;

ALTER TABLE public.sessoes
  ADD COLUMN IF NOT EXISTS subtema_id uuid REFERENCES public.subtemas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sessoes.subtema_id IS
  'Drop 2.5: escopo de uma sessão tipo=treino filtrada por subtema (loop do cronograma). '
  'NULL em prova_oficial/simulado (exame inteiro via exame_id). Mutuamente exclusivo com exame_id na prática.';

CREATE INDEX IF NOT EXISTS idx_sessoes_subtema ON public.sessoes (subtema_id);

COMMIT;
-- PÓS: supabase gen types typescript --local > src/lib/types/db.types.ts
```

> RLS: `sessoes` já tem políticas single-user (auth.uid()=user_id). Adicionar coluna **não** exige policy nova. Fronteira do gabarito **intocada**: o treino lê de `questoes_prova` (sem gabarito); correção só em `finalizeSession` (service_role).

### 4.2 `startTreinoSubtema` — em `src/app/(teste)/_actions/sessao.actions.ts`

Adicionar junto de `startSession` (coesão com o runner + finalize):

```ts
const StartTreinoSubtemaSchema = z.object({ subtemaId: z.string().uuid() });

/** Cria sessão tipo=treino escopada por subtema (exame_id=NULL). Loop do cronograma. */
export async function startTreinoSubtema(
  subtemaId: string
): Promise<{ sessaoId: string } | { error: string }> {
  const parsed = StartTreinoSubtemaSchema.safeParse({ subtemaId });
  if (!parsed.success) return { error: "Subtema inválido." };

  const supabase = await createActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Usuário não autenticado." };

  // Guard de honestidade: só cria sessão se houver questão respondível (anti-treino-vazio)
  const { count } = await supabase
    .from("questoes_prova")
    .select("id", { count: "exact", head: true })
    .eq("subtema_id", parsed.data.subtemaId);
  if (!count || count === 0) {
    return { error: "Ainda não há questões disponíveis deste subtema." };
  }

  const { data, error } = await supabase
    .from("sessoes")
    .insert({
      user_id: user.id,
      tipo: "treino",
      exame_id: null,
      subtema_id: parsed.data.subtemaId,
      inicio: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[startTreinoSubtema] Erro:", error);
    return { error: "Erro ao iniciar treino. Tente novamente." };
  }
  return { sessaoId: data.id };
}
```

### 4.3 Runner — branch de carga de questões em `src/app/(teste)/teste/[sessaoId]/page.tsx`

O runner já lê só de `questoes_prova` (gabarito-safe). Trocar o guard exame-only por um branch exame/subtema:

```ts
// SELECT da sessão: adicionar subtema_id
const { data: sessao, error: sessaoError } = await supabase
  .from("sessoes")
  .select("id, exame_id, subtema_id, tipo, inicio, fim")
  .eq("id", sessaoId)
  .eq("user_id", user.id)
  .single();
// ... (checks existentes de sessao/fim mantidos) ...

// REMOVER o guard "if (!sessao.exame_id) redirect('/teste')".
// Branch de carga (substitui o bloco questoesResult):
let questoesQuery = supabase
  .from("questoes_prova")
  .select(COLUNAS_QUESTAO_PROVA.join(", "));

if (sessao.exame_id) {
  questoesQuery = questoesQuery.eq("exame_id", sessao.exame_id).order("num_prova", { ascending: true });
} else if (sessao.subtema_id) {
  questoesQuery = questoesQuery
    .eq("subtema_id", sessao.subtema_id)
    .order("num_prova", { ascending: true })
    .limit(TREINO_SUBTEMA_LIMITE);            // de config.ts (ver §4.5)
} else {
  redirect("/teste");
}
const questoesResult = await questoesQuery;
// ... resto idêntico (narrowing, respostasExistentes, <ProvaRunner .../>) ...
```

`saveResposta` / `finalizeSession` / `prova-runner.tsx` / `resultado/[sessaoId]` **não mudam** — são exame-agnósticos (operam por `sessaoId`/`questaoId`). A página de resultado já agrega por subtema com badge `<8`.

### 4.4 Página `/treino` — pré-tela honesta + start

**`src/app/(estudo)/treino/page.tsx`** (hoje stub) → RSC que lê `?subtema`, conta disponíveis e renderiza o form:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import IniciarTreinoForm from "./iniciar-treino-form";

interface Props { searchParams: Promise<{ subtema?: string }>; }

export default async function TreinoPage({ searchParams }: Props) {
  const { subtema } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sem subtema: explicação + atalho p/ prova inteira (matéria-fallback cai aqui)
  if (!subtema) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Treino Focado</h1>
        <p className="text-gray-500 mb-4">
          Abra um bloco de <strong>Questões</strong> no seu{" "}
          <a href="/plano" className="text-blue-600 underline">plano do dia</a> para treinar o subtema priorizado,
          ou faça uma <a href="/teste" className="text-blue-600 underline">prova/simulado completo</a>.
        </p>
      </div>
    );
  }

  const { data: sub } = await supabase
    .from("subtemas")
    .select("id, nome, materias:materia_id(nome)")
    .eq("id", subtema)
    .single();
  const { count } = await supabase
    .from("questoes_prova")
    .select("id", { count: "exact", head: true })
    .eq("subtema_id", subtema);

  const materiaNome = (sub?.materias as { nome: string } | null)?.nome ?? "Matéria";
  const disponiveis = count ?? 0;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <p className="text-xs text-gray-400">{materiaNome} ›</p>
      <h1 className="text-2xl font-bold mb-2">{sub?.nome ?? "Subtema"}</h1>
      {disponiveis > 0 ? (
        <>
          <p className="text-gray-500 mb-6">{disponiveis} questões disponíveis deste subtema.</p>
          <IniciarTreinoForm subtemaId={subtema} />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-amber-800 text-sm">
          Ainda não há questões respondíveis deste subtema (serão adensadas no próximo backfill).
          Estude o conteúdo e volte depois.
        </div>
      )}
    </div>
  );
}
```

**`src/app/(estudo)/treino/iniciar-treino-form.tsx`** (client, espelha `iniciar-prova-form.tsx`):

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startTreinoSubtema } from "@/app/(teste)/_actions/sessao.actions";

export default function IniciarTreinoForm({ subtemaId }: { subtemaId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleIniciar() {
    setLoading(true); setError(null);
    const r = await startTreinoSubtema(subtemaId);
    if ("error" in r) { setError(r.error); setLoading(false); return; }
    router.push(`/teste/${r.sessaoId}`);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleIniciar}
        disabled={loading}
        className="rounded-lg bg-purple-600 text-white px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-60"
      >
        {loading ? "Iniciando..." : "Iniciar treino do subtema"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
```

### 4.5 `src/lib/planner/config.ts` — constante do limite de treino

```ts
// --- Loop de Desempenho (Drop 2.5) --- APPEND
/** Máx. de questões carregadas num treino de subtema. Cobre o pool dos top subtemas (7–14)
 *  com folga; calibrável. Subtemas com >limite questões: futuro "menos-recentes primeiro". */
export const treinoSubtemaLimite = 30;
```
Importar como `import { treinoSubtemaLimite as TREINO_SUBTEMA_LIMITE } from "@/lib/planner/config";` no runner.

### 4.6 Fechamento automático do loop

Nenhum fio extra: `finalizeSession` → `corrigir_sessao` preenche `respostas.correta` → `v_respostas_corrigidas` (WHERE correta NOT NULL) capta → `diag_por_no` (eixo='subtema') recalcula `taxa`/`n_feitas`/`amostra_suficiente` daquele subtema → o **próximo** `gerarCronograma` lê via `fetchDiagSubtema` → subtemas fracos (taxa baixa, amostra≥8) ganham `weaknessScore` maior → mais/antes blocos. **Re-priorização automática.**

---

## 5. Garantias anti-chute (explícito)

| Garantia | Mecanismo | Onde |
|----------|-----------|------|
| **Cold-start = incidência-led** | Subtema com `nFeitas<8` → `weaknessScore=null` → cronograma usa `pesoIncidencia` (COUNT real) → ranking por incidência DESC | `weakness-score.ts` (gate) + `cronograma.ts` (cold-start fallback) |
| **Fraqueza só com amostra** | Gate ≥8 em DUAS camadas: view (`amostra_suficiente`) E app (`weaknessScore` retorna null < gate) | `diag_por_no` + `weakness-score.ts` |
| **Zero subtema hardcoded** | Universo 100% de `v_incidencia_subtema` (COUNT de questões reais). Ética distribuída entre subtemas de Ética COBRADOS, não lista fixa | `v_incidencia_subtema` + action |
| **Fato vs recomendação** | SQL = fatos (incidência, taxa, amostra). App = priorização/dose (calibrável sem migration) | views vs `config.ts`/`weakness-score.ts` |
| **Único "hardcode" = política do edital** | `ETICA_RE` marca o BLOCO de Ética (regra ≥15% do edital) — política legal, não dado inventado | `cronograma.ts` |
| **Treino nunca vazio sem aviso** | `startTreinoSubtema` recusa subtema com 0 respondíveis; `/treino` mostra estado honesto | §4.2 + §4.4 |

---

## 6. Backward-compat / capability preservation

- **Tudo aditivo:** 2 migrations (CREATE OR REPLACE VIEW; ADD COLUMN IF NOT EXISTS). Nenhum DROP/ALTER destrutivo. Re-rodáveis.
- **`gerarCronograma` matéria-path vira fallback** (D-B): matérias sem subtema cobrado ainda geram blocos matéria-level (`subtema_id=null`). Nenhuma matéria some.
- **Blocos antigos (subtema_id=null) continuam renderizando** — a UI faz fallback p/ `materiaNome` (§2.5).
- **Pilar de questões intocado:** `startSession`/prova-runner/finalize/resultado inalterados; só o runner ganha um branch de carga e a sessão um campo opcional.
- **`planner.actions.ts`/`plano_diario` preservados** (D-F): seguem matéria-level; o loop real roda pelo cronograma+treino.
- **Gerador puro (`cronograma.ts`) quase intocado:** só exporta 1 helper e troca 1 split por flag. Algoritmo de alocação/sequenciamento idêntico.

---

## 7. Edge cases & trade-offs

### 7.1 Subtema com incidência mas 0 respondíveis (todas anuladas/filtradas)
`n_questoes>0` mas `n_disponiveis=0`. **Conteúdo** continua sendo agendado (ela deve aprender o tema). O bloco de **questões** linka a `/treino?subtema=` que mostra estado honesto ("0 disponíveis") e `startTreinoSubtema` recusa criar sessão. Sem sessão-morta. (Raridade da cauda fina; Drop 3 adensa.)

### 7.2 Matéria sem subtema cobrado (D-B)
Vira nó matéria-level (fallback). Concorre de forma justa: `materias.questoes_por_prova` e `v_incidencia_subtema.n_questoes` estão na MESMA unidade (questões/exame), então a alocação proporcional mistura matéria e subtema sem viés de escala.

### 7.3 Dose de Ética em granularidade de subtema
`pisoEticaMin` (minutos) distribuído entre nós de Ética existentes (subtemas de Ética cobrados; ou matéria-fallback de Ética). Math inalterada — é por minutos sobre o conjunto de nós Ética, agnóstica de granularidade (§3).

### 7.4 (Opcional) `gerarPlano`/`plano_diario` em subtema
Fora do escopo 2.5 (D-F). Caminho futuro: `fetchNosMateria` → `fetchNosSubtema` (mesmo merge incidência×diag) em `planner.actions.ts`; `gerarPlano` já é eixo-agnóstico (`ItemPlano.subtema?` existe). Não fazer agora — não acelera o DoD e o loop já roda pelo treino.

### 7.5 Re-resposta das mesmas questões infla `n_feitas`
Treino recarrega o pool do subtema a cada sessão; re-responder conta de novo (volume cresce, taxa reflete o estado atual). Aceitável p/ 2.5 (ajuda a cruzar o gate). Futuro: ordenar por "menos-recentes/não-respondidas".

### 7.6 Mistura de unidades de peso (cold vs warm) no mesmo pool
Pré-existente (já ocorre em matéria): nós cold usam `pesoIncidencia` (≈0–14), warm usam `weaknessScore` (≈0–70). **Intencional** — fraqueza PROVADA pesa mais que incidência presumida; e quando tudo é cold (início), o ranking é incidência-pura (exatamente o pedido). Não alterar (reuse dos planners).

### 7.7 `incidenciaMax=20` calibrado p/ matéria, não subtema (D-E)
`incid = pesoIncidencia/20` nunca satura p/ subtema (max ≈14). Como a alocação é proporcional/relativa, o escalar uniforme não muda ranking nem fatias. Não recalibrar (evita migration). Se um dia quiser score absoluto por subtema, parametrizar `incidenciaMax` por eixo no app.

---

## 8. Ordem de implementação (sugerida p/ @dev)

1. Migration `20260627120000_incidencia_subtema.sql` + `20260627120001_sessao_subtema_treino.sql` → `supabase db push` → `supabase gen types` (regenera `db.types.ts`).
2. `domain.ts` (+`eEtica?`), `config.ts` (+`treinoSubtemaLimite`).
3. `cronograma.ts` (export `nomeEhEtica` + split por flag).
4. `cronograma.actions.ts` (fetch+merge subtema, fallback matéria, INSERT branch, join subtemas na leitura, +recentErros opcional).
5. UI: `cronograma-view.tsx` + `plano-do-dia.tsx` (breadcrumb + deep-link).
6. Loop: `sessao.actions.ts` (`startTreinoSubtema`), `teste/[sessaoId]/page.tsx` (branch), `treino/page.tsx` + `iniciar-treino-form.tsx`.
7. Testes (§9).

---

## 9. Test checklist

### 9.1 Unit — `tests/unit/cronograma.test.ts` (estende o existente)
- [ ] **Cold-start subtema:** nós de subtema com `nFeitas=0`, vários `pesoIncidencia` → blocos ordenados por incidência DESC (subtema mais cobrado nos primeiros dias). Nenhum `weaknessScore` aplicado.
- [ ] **Warm subtema re-prioriza:** subtema com `nFeitas≥8, taxa baixa` recebe mais minutos que subtema de incidência igual e taxa alta.
- [ ] **Ética por flag:** nós com `eEtica=true` (nome de subtema que NÃO casa `ETICA_RE`, ex.: "Honorários") recebem a dose de Ética (≥15% / 90min·semana). Sem a flag, o mesmo nó NÃO entraria em Ética.
- [ ] **Backward-compat matéria:** nós matéria-level (sem `eEtica`) com nome "Ética e Estatuto da OAB" continuam caindo em Ética via `ETICA_RE`.
- [ ] **Mix eixo:** input com subtemas + matérias-fallback → cada bloco preserva seu `eixo`/`noId` corretos.
- [ ] **`nomeEhEtica`** unit direto: casa Ética/Estatuto OAB/Direitos Humanos/Filosofia; não casa "Cumprimento de sentença".

### 9.2 Migration / DB
- [ ] `v_incidencia_subtema` retorna 1 linha por subtema cobrado; `n_questoes` = COUNT real; `n_disponiveis ≤ n_questoes`; `materia_id`/`materia_nome` corretos.
- [ ] Subtema sem questões NÃO aparece (INNER JOIN).
- [ ] `sessoes.subtema_id` existe, nullable, FK→subtemas; provas oficiais antigas têm `subtema_id=null`.
- [ ] Re-rodar ambas as migrations é no-op (idempotência).
- [ ] `db.types.ts` regenerado contém `v_incidencia_subtema` e `sessoes.subtema_id`.

### 9.3 Integração — action
- [ ] `gerarCronograma` insere blocos com `subtema_id` setado E `materia_id` = matéria-pai (ambos não-nulos) p/ eixo subtema.
- [ ] Matéria sem subtema cobrado → bloco com `materia_id` setado, `subtema_id=null`.
- [ ] `_carregarBlocos` retorna `subtemaNome` populado (join subtemas).
- [ ] Preserve-rule intacta (DELETE só `gerado`+`pendente`+futuro).

### 9.4 Loop E2E (manual + spec)
- [ ] Bloco de questões em `/plano` → link `/treino?subtema=ID` → "Iniciar treino" → `/teste/{id}` carrega só questões DAQUELE subtema, **sem gabarito** (regressão: `gabarito-nao-vaza.spec.ts` continua passando).
- [ ] Responder + finalizar → `/resultado/{id}` mostra acerto por subtema + badge `<8`.
- [ ] Após finalizar, **regenerar cronograma** → o subtema treinado aparece com peso ajustado pela taxa (re-priorização).
- [ ] Subtema com `n_disponiveis=0` → `/treino` mostra estado honesto; `startTreinoSubtema` recusa.
- [ ] `/cronograma` e `/plano` exibem "Matéria › Subtema"; blocos legados (subtema_id=null) caem p/ matéria sem quebrar.

### 9.5 Segurança (não-regressão)
- [ ] `questoes_prova` continua sem coluna gabarito; treino de subtema usa essa view.
- [ ] `corrigir_sessao` (service_role) é o ÚNICO caminho que lê gabarito; treino não expõe nada novo.

---

## 10. Resumo de arquivos

**Migrations (novas):**
- `supabase/migrations/20260627120000_incidencia_subtema.sql`
- `supabase/migrations/20260627120001_sessao_subtema_treino.sql`

**Código (editados):**
- `src/lib/types/domain.ts` — `NoDiagnostico.eEtica?`
- `src/lib/planner/cronograma.ts` — export `nomeEhEtica` + split Ética por flag
- `src/lib/planner/config.ts` — `treinoSubtemaLimite`
- `src/app/(estudo)/_actions/cronograma.actions.ts` — fetch/merge subtema, fallback matéria, INSERT branch, join subtemas, (recentErros opcional)
- `src/app/(estudo)/cronograma/cronograma-view.tsx` — breadcrumb + deep-link
- `src/app/(estudo)/plano/plano-do-dia.tsx` — breadcrumb + deep-link
- `src/app/(teste)/_actions/sessao.actions.ts` — `startTreinoSubtema`
- `src/app/(teste)/teste/[sessaoId]/page.tsx` — branch exame/subtema na carga
- `src/app/(estudo)/treino/page.tsx` — RSC pré-tela (de stub)
- `src/lib/types/db.types.ts` — regenerado (gen types)

**Código (novos):**
- `src/app/(estudo)/treino/iniciar-treino-form.tsx`

**Inalterados (reuso):** `cronograma.ts` algoritmo, `planner.ts`, `weakness-score.ts`, `diag_por_no`/`diag_weakness_score`/`questoes_prova` views, `saveResposta`/`finalizeSession`/`corrigir_sessao`, `prova-runner.tsx`, `resultado/[sessaoId]`.
```
