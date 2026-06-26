# Advoga — SCHEMA (Motor de Diagnóstico)

> **Owner do doc:** Dara (@data-engineer) · **Criado:** 2026-06-21 · **Fase:** EP-0 / Fundação
> **Fonte da verdade:** `kamile-oab/01-BRIEF.md` §8 (CANÔNICO) · **Stack:** PostgreSQL / Supabase
> **Migrations:** `supabase/migrations/2026062112000{0,1,2}_*.sql`
> **Status:** schema escrito (NÃO aplicado — sem DB no ar). Válido para `supabase db push`.

Guia de estudos OAB 1ª fase, **data-driven** e **single-user** (Kamile). O schema é a
camada de **fatos** (respostas vs gabarito) sobre a qual roda o diagnóstico granular,
anti-chute (§4) e com **dimensões transversais ABERTAS** (D-06, §8.5).

---

## 1. Princípios que governam o modelo

| # | Princípio | Como o schema honra |
|---|-----------|---------------------|
| **Dimensões ABERTAS** (D-06) | Novo eixo de análise = **INSERT**, nunca `ALTER TABLE`. | EAV: `dimensoes` + `dimensao_valores` + `questao_tags`. |
| **Anti-chute** (§4) | Nunca declarar fraqueza com amostra pequena. | Gate `>= 8` **explícito** como flag `amostra_suficiente` nas views. |
| **Multi-user ready** (D-01) | Single-user hoje, multi-user sem retrabalho. | Toda tabela de dados da usuária tem `user_id -> auth.users`; RLS já usa `auth.uid()`. |
| **Granularidade > agregado** (§4) | "82% em Civil" não esconde "41% em Posse". | Diagnóstico por nó em qualquer eixo + cross-axis subtema×dimensão. |
| **Validade legal** (§3/§10) | Lei vigente até 25/05/2026. | `questoes.validade_status` (enum) + `validade_motivo`. |
| **Correctness > speed** (Dara) | Integridade primeiro. | FKs, CHECKs, enums fechados, triggers de consistência. |

---

## 2. Diagrama textual das relações

```
auth.users (Supabase Auth)
   │
   │ 1───N  (user_id)                          ┌──────────────────────────────┐
   ├───────────────► sessoes ──1──N──► respostas ──N──1──► questoes           │
   │                    │ exame_id?              │ questao_id        │         │
   │                    └──────────┐             │ user_id (desnorm) │         │
   ├───────────────► plano_diario  │             └───────────────────┘         │
   │                               │                                           │
   │                               ▼                                           │
   │                            exames ◄──────── exame_id? ────────────────────┘
   │
   │   ===== EIXO DE CONTEÚDO (hierárquico, §8.1) =====
   │     materias ──1──N──► subtemas ──1──N──► micro_topicos
   │        │ grupo A|B|C        ▲                   ▲
   │        │ questoes_por_prova │ subtema_id        │ micro_topico_id
   │        └───────────────► questoes ──────────────┘
   │                             materia_id (NOT NULL)
   │
   │   ===== DIMENSÕES TRANSVERSAIS ABERTAS (EAV, §8.5) =====
   │     dimensoes ──1──N──► dimensao_valores
   │        │ chave/tipo            │
   │        │                       │ valor_id
   │        └──────► questao_tags ◄─┘
   │                   │ questao_id ──► questoes
   │                   │ dimensao_id ─► dimensoes
   │                   │ (valor_id | valor_bool | valor_num)  -- exatamente 1
   │                   │ origem: humano|llm|minerado
   │
   │   ===== VIEWS DE DIAGNÓSTICO (computadas, §8.3) =====
   │     v_respostas_corrigidas  (base: respostas corrigidas + conteúdo)
   │     diag_por_no             (materia|subtema|micro|<dimensão> -> taxa, tendência, GATE)
   │     diag_cross_subtema_dimensao  (a "mágica": subtema × dimensão)
   │     diag_weakness_score     ((1-taxa) × confiança_volume × peso_incidência)
```

### Cardinalidades-chave
- `materias 1─N subtemas 1─N micro_topicos` — hierarquia de conteúdo.
- `questoes N─1 materias` (obrigatório), `N─1 subtemas` / `micro_topicos` (progressivo por drop).
- `questoes 1─N questao_tags N─1 dimensoes` — N dimensões por questão (EAV).
- `sessoes 1─N respostas N─1 questoes` — uma resposta por (sessão, questão).
- `auth.users 1─N {sessoes, respostas, plano_diario}` — dados da usuária.

---

## 3. Tabelas (resumo)

### Conteúdo de prova (compartilhado — RLS leitura authenticated, escrita service_role)
| Tabela | Papel | Colunas notáveis |
|--------|-------|------------------|
| `materias` | 20 disciplinas OAB | `grupo` (A\|B\|C), `questoes_por_prova` = **peso de incidência** (§6) |
| `subtemas` | nível intermediário (Civil→Posse) | `materia_id`, único por matéria |
| `micro_topicos` | folha da hierarquia | `subtema_id`, entra no Drop 2 |
| `dimensoes` | **catálogo ABERTO** de eixos | `chave`, `tipo` (categorica\|booleana\|numerica), `ativa` |
| `dimensao_valores` | domínio de valores categóricos | `dimensao_id`, `valor` |
| `exames` | edição da prova | `numero_romano`, `edicao`, `tipo_prova` |
| `questoes` | unidade central | 4 alternativas, `gabarito`, `dificuldade` (empírica), `validade_status`, `fonte_url` |
| `questao_tags` | **EAV**: N tags/questão | `dimensao_id` + 1 de (`valor_id`\|`valor_bool`\|`valor_num`), `origem` |

### Dados da usuária (RLS `auth.uid() = user_id`)
| Tabela | Papel | Colunas notáveis |
|--------|-------|------------------|
| `sessoes` | rodada prova/simulado/treino | `user_id`, `tipo`, `inicio/fim`, `duracao_seg` (GENERATED) |
| `respostas` | **FATO bruto** (resposta vs gabarito) | `correta`, `tempo_seg`, `user_id` (desnorm. por trigger) |
| `plano_diario` | saída do planner (§8.4) | `horas`, `questoes_alvo`, `distribuicao_json` (JSONB) |

### Views de diagnóstico (§8.3)
| View | Entrega |
|------|---------|
| `v_respostas_corrigidas` | base reutilizável: respostas corrigidas + conteúdo |
| `diag_por_no` | taxa/tendência por **qualquer eixo** + `amostra_suficiente` (gate) |
| `diag_cross_subtema_dimensao` | **cross-axis**: taxa por subtema × dimensão |
| `diag_weakness_score` | score de fraqueza ponderado por incidência (ordena alvos) |

---

## 4. Decisões de design (e o porquê)

1. **EAV para dimensões, enum para o resto.**
   Dimensões transversais são **conjunto aberto** (D-06) → linhas, não colunas/enum.
   Já `grupo`, `validade_status`, `tipo_prova`, `sessao_tipo`, `tag_origem` são domínios
   **fechados** → enums (validação barata, legível). A fronteira é deliberada.

2. **`questao_tags` com 3 colunas de valor + CHECK "exatamente um".**
   `valor_id` (categórico, FK), `valor_bool`, `valor_num` cobrem os 3 `dimensao.tipo`.
   Um CHECK garante que exatamente uma esteja preenchida → integridade EAV sem tabela por tipo.

3. **`respostas.user_id` desnormalizado de `sessoes`.**
   Evita subquery por linha na RLS e nas agregações de diagnóstico (mais rápido).
   Consistência garantida por **trigger** `sync_resposta_user_id` (herda dono da sessão) —
   não dá pra forjar via cliente.

4. **`correta` persistido, não calculado on-the-fly.**
   O veredito é gravado na correção (compara `resposta_dada` com `questoes.gabarito`),
   snapshot do momento. Robusto a re-gabaritagem/anulação futura. `NULL` enquanto a
   sessão não foi finalizada (§7: "finalizar" libera gabarito).

5. **`dificuldade` é empírica e NULLABLE.**
   Derivada do % de acerto (§8.1), preenchida por processo de diagnóstico. Fica `NULL`
   até haver amostra — coerente com anti-chute.

6. **Gate de volume nas VIEWS, não no schema.**
   `diag_gate_minimo()` = 8 (single source of truth). As views expõem
   `amostra_suficiente` como **coluna** — o dado nunca esconde o tamanho da amostra.
   Trocar o limiar = trocar 1 função.

7. **Views regulares no Drop 1 (não materializadas).**
   Volume single-user é baixo; índices cobrem as agregações; tempo-real honesto.
   Caminho de escala documentado no rodapé de `20260621120001` (→ MATERIALIZED VIEW + REFRESH).

8. **`distribuicao_json` como JSONB.**
   O formato do plano do dia evolui (planner v1→v2) sem migration.

9. **`exame_id` NULLABLE em `questoes`/`sessoes`** (`ON DELETE SET NULL`).
   Questão pode existir antes de amarrar à edição; apagar exame não destrói histórico.

10. **`micro_topico_id` exige `subtema_id`** (CHECK) — integridade da hierarquia.

11. **RLS ON em TODAS as tabelas `public`.**
    Supabase expõe tudo via PostgREST. Sem RLS, tabela fica aberta. Conteúdo =
    RLS + só policy SELECT (escrita fechada, service_role bypassa). Dados da usuária =
    policies `auth.uid() = user_id`.

---

## 5. Como adicionar uma DIMENSÃO NOVA (passo a passo) — o coração do §8.5

> Cenário: a mineração (§8.5) descobre que a Kamile erra mais em questões com
> **comando negativo** ("assinale a INCORRETA"). Queremos passar a medir isso.
> **NÃO se altera o schema. Só se inserem linhas + tags.**

### Caso A — dimensão BOOLEANA (ex.: `comando_negativo`)
```sql
-- 1. registra o eixo no catálogo
INSERT INTO public.dimensoes (chave, nome, tipo, descricao)
VALUES ('comando_negativo', 'Comando negativo (assinale a INCORRETA)', 'booleana',
        'Questão cujo enunciado pede a alternativa ERRADA.');

-- 2. (boolean não precisa de dimensao_valores)

-- 3. tagueia as questões (humano | llm | minerado)
INSERT INTO public.questao_tags (questao_id, dimensao_id, valor_bool, origem, confianca)
SELECT q.id, d.id, true, 'llm', 0.93
FROM public.questoes q
CROSS JOIN public.dimensoes d
WHERE d.chave = 'comando_negativo'
  AND q.enunciado ~* '(incorret|errad|EXCETO|não\s+é|nao\s+e)';
```

### Caso B — dimensão CATEGÓRICA (ex.: `estilo_cognitivo`, a semente do §8.1)
```sql
-- 1. registra o eixo
INSERT INTO public.dimensoes (chave, nome, tipo, descricao)
VALUES ('estilo_cognitivo', 'Estilo cognitivo', 'categorica',
        'Natureza da habilidade exigida pela questão.');

-- 2. registra os VALORES possíveis
INSERT INTO public.dimensao_valores (dimensao_id, valor, ordem)
SELECT d.id, v.valor, v.ord
FROM public.dimensoes d
CROSS JOIN (VALUES
  ('letra_de_lei',1), ('jurisprudencia',2), ('caso_concreto',3),
  ('pegadinha',4), ('interdisciplinar',5)
) AS v(valor, ord)
WHERE d.chave = 'estilo_cognitivo';

-- 3. tagueia (valor_id aponta p/ dimensao_valores)
INSERT INTO public.questao_tags (questao_id, dimensao_id, valor_id, origem)
SELECT :questao_id, d.id, dv.id, 'humano'
FROM public.dimensoes d
JOIN public.dimensao_valores dv ON dv.dimensao_id = d.id
WHERE d.chave = 'estilo_cognitivo' AND dv.valor = 'caso_concreto';
```

### Caso C — dimensão NUMÉRICA (ex.: `tamanho_enunciado` em nº de chars)
```sql
INSERT INTO public.dimensoes (chave, nome, tipo, descricao)
VALUES ('tamanho_enunciado', 'Tamanho do enunciado (chars)', 'numerica',
        'Comprimento do enunciado; testa hipótese de fadiga de leitura.');

INSERT INTO public.questao_tags (questao_id, dimensao_id, valor_num, origem)
SELECT id, (SELECT id FROM public.dimensoes WHERE chave='tamanho_enunciado'),
       length(enunciado), 'minerado'
FROM public.questoes;
```

### O que acontece **automaticamente** depois do INSERT
- `diag_por_no` passa a emitir nós com `eixo = '<chave da nova dimensão>'` — **sem tocar na view**.
- `diag_cross_subtema_dimensao` passa a cruzar subtema × nova dimensão.
- O Motor de Descoberta (§8.5) mede a taxa de erro por valor e ranqueia se o eixo prediz erro.
- Se NÃO predizer, basta `UPDATE public.dimensoes SET ativa=false WHERE chave='...'`
  → some das views, **sem perder** as tags históricas.

> **Loop §8.5:** dimensão nova → retagueia banco → re-roda diagnóstico (views recomputam).
> O sistema fica mais inteligente quanto mais a Kamile usa.

---

## 6. Nota de GATE DE VOLUME (anti-chute, §4) — leitura obrigatória p/ @dev e @qa

> **Regra inegociável:** a aplicação **NUNCA** rotula um nó como "fraqueza" / alvo de
> reforço se `amostra_suficiente = false`.

- Limiar default: **`n_feitas >= 8`** (`public.diag_gate_minimo()`).
- Toda view de diagnóstico expõe `amostra_suficiente` (boolean) + `gate_minimo` (int).
- Abaixo do gate, o produto deve dizer: *"amostra insuficiente — vou te dar mais disso
  para medir"* (verbatim brief), **nunca** uma taxa apresentada como veredito.
- `weakness_score` só é significativo quando `amostra_suficiente = true` — a app filtra.
- `tendencia` pode ser `NULL` (uma das metades temporais vazia) — tratar como "sem sinal".

**Fato vs. recomendação (§4):** a taxa é fato; "estude regra-matriz de incidência" é
recomendação rotulada, sempre rastreável ao dado (`no_id` + `n_feitas`) que a gerou.

---

## 7. Ordem de aplicação das migrations

```bash
# local-first (Docker). Mesma sequência roda no cloud da Kamile no deploy.
supabase start
supabase db push     # aplica em ordem lexicográfica:
#   20260621120000_init_schema.sql        (tabelas, enums, índices, triggers)
#   20260621120001_diagnostico_views.sql  (views + gate function)
#   20260621120002_rls_single_user.sql    (RLS + policies)
```

Dependências respeitadas pela numeração: schema → views (dependem das tabelas) →
RLS (depende das tabelas). Idempotentes onde aplicável (re-rodáveis com segurança).

---

## 8. Pontos a alinhar com @architect (Aria)

1. **Modelo de correção:** confirmar que `respostas.correta` é gravado pela aplicação
   no "finalizar sessão" (§7), e a política de re-gabaritagem quando uma questão é
   **anulada** depois (reprocessar histórico? ou manter snapshot?). Schema suporta ambos.
2. **`auth.users` (Supabase Auth):** RLS pressupõe Auth ativo. Confirmar fluxo de login
   da Kamile e seeding do `user_id` dela no setup local.
3. **Ingestão/tagging via service_role:** confirmar que o pipeline (ultracode/§12) usa a
   `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) — alinhado com a estratégia de escrita de conteúdo.
4. **Velocidade do planner (~30 q/h):** calibrável (§13.5), só afeta lógica do planner
   sobre `plano_diario` — não toca schema.
5. **Materialização das views:** decidir em qual drop promover `diag_por_no` para
   MATERIALIZED VIEW (gatilho: volume / latência percebida no dashboard).
```
