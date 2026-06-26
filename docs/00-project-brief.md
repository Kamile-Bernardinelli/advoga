# ADVOGA — Project Brief (AIOX-Native)

> **Status:** CONGELADO para handoff AIOX.
> **Owner:** Marcos Cezarinni | **Usuária:** Kamile | **Build:** `apps/_active/advoga/`
> **Fontes:** `00-BRAINDUMP-RAW.md` (verbatim, vence em conflito) · `01-BRIEF.md` (PRD) · `02-RESEARCH-exam-and-sources.md` (fatos verificados) · `docs/research/edital-47-verification.md` (verificação direta)
> **Notação:** [FATO] = derivado de dado verificado | [REC] = recomendação rastreável ao dado

---

## 1. NORTH STAR

Um **guia master de estudos OAB 1ª fase, data-driven e pessoal**, que diz à Kamile — *sem chute, com base em dados de provas reais* — exatamente onde ela está fraca (até o micro-tópico e o tipo de questão), quanto isso pesa na prova, e o que fazer hoje com as horas que ela tem. Não é cursinho. É um sistema de forja.

> Lema (verbatim Kamile): *"brutalmente realista, com base em dados... para me forjar brutalmente nessa porra."*

---

## 2. RESTRIÇÃO DURA (define tudo)

| Marco | Data | Status |
|---|---|---|
| **Prova 1ª fase — 47º EOU** | **06/09/2026** | [FATO] Confirmado OAB/FGV oficial |
| **Dias restantes** | **77 dias** (a partir de 21/06/2026) | [FATO] |
| Corte legislativo | 25/05/2026 | [FATO] Data do edital — âncora do Motor de Validade |
| Prova 2ª fase (futuro) | 18/10/2026 | [FATO] Tributário; fora do MVP |
| Resultado final 1ª fase | 05/10/2026 | [FATO] |

**Implicação central:** 77 dias é apertado. O sistema **tem que ser usável em dias, não semanas.** Toda decisão de escopo é subordinada a: *"isto faz a Kamile resolver mais questões reais com correção granular, mais cedo?"*. Se não, vai para depois.

---

## 3. USUÁRIA & CONTEXTO

- Kamile — concluindo Direito (UCDB, Campo Grande/MS), 1ª tentativa OAB, nunca fez nenhuma fase.
- Autodidata forte: não precisa de ensino do conteúdo; precisa de **diagnóstico e direção**. [K verbatim: "o autodidatismo vai me ajudar."]
- Disponibilidade típica: **3–4h/dia** de estudo 100% focado (variável). [FATO — declarado por Kamile]
- Uso primário: **desktop/notebook** (provas longas + gráficos); celular = consulta rápida.
- Velocidade de resolução: **~30 q/h** [REC — parâmetro calibrável do planner; não foi medido ainda]. Ver D-08.

---

## 4. PRINCÍPIO INEGOCIÁVEL — REALISMO BRUTAL (anti-chute)

Toda afirmação do tipo *"você está fraca em X"* precisa ser **derivada de dados** (respostas dela vs. gabarito), nunca inferida. Regras operacionais:

1. **Limiar de confiança:** um nó (tema/dimensão) só vira "alvo de reforço" com **volume mínimo de questões feitas ≥ 8**. Abaixo disso: *"amostra insuficiente — vou te dar mais disso para medir."*
2. **Fato vs. recomendação:** estatística (acertos/erros) é **[FATO]**; "estude regra-matriz de incidência" é **[REC]**, sempre rastreável ao dado que a gerou.
3. **Sem médias enganosas:** granularidade vence agregados. "82% em Civil" nunca esconde "41% em Posse". O sistema expõe a dimensão mais granular disponível.

---

## 5. DECISÕES TRAVADAS

| ID | Decisão | Fonte | Consequência |
|---|---|---|---|
| D-01 | **1ª fase agora + arquitetura preparada p/ 2ª** | [M] | Schema e motor acomodam peças/Tributário; UI da 2ª fase só depois da prova |
| D-02 | **Ingerir TUDO + selo de validade; ordem recente→antigo** | [M][K] | Destino = 46 edições (~3.680q). Motor de Validade Legal vira load-bearing |
| D-03 | **Next.js + Supabase + Vercel — Supabase na conta da KAMILE** | [M] adendo | Dados de estudo são dela. Single-user RLS. Keys via `.env` (nunca commitar). Setup exige project-ref + keys dela |
| D-04 | **Desktop-first** | [M][K] | Prova de 80q + dashboard p/ tela grande; responsivo p/ consulta mobile |
| D-05 | **Data-alvo 06/09/2026 (77 dias)** | [FATO] | MVP cirúrgico. Tudo subordinado ao tempo |
| D-06 | **Dimensões transversais = conjunto ABERTO** | [M][K] | "Estilo" é só 1 exemplo. Schema extensível + Motor de Descoberta (§8) |
| D-07 | **Nome = Advoga** | [M] | Verbo de "advogado"; ativo; vendável se virar produto. Build: `apps/_active/advoga/` |
| D-08 | **Velocidade default do planner = ~30 q/h** | [REC calibrável] | Parâmetro editável no planner. Medir velocidade real da Kamile na primeira sessão e ajustar |

---

## 6. A PROVA — DADOS OBJETIVOS

[FATO] 80 questões, 20 disciplinas, aprovação com **40 acertos (50%)**, duração 5h.

### 6.1 Distribuição por disciplina — CONFIRMADA

Tabela confirmada por múltiplas fontes secundárias convergentes (ver `edital-47-verification.md`). PDF oficial não foi legível diretamente — ver nota de confiança.

| # | Disciplina | Questões | Posição | Grupo | % da prova |
|---|---|---|---|---|---|
| 1 | **Ética Profissional / Estatuto OAB** | **8** | 01–08 | A | 10,0% |
| 2 | Filosofia do Direito | 2 | 09–10 | C | 2,5% |
| 3 | **Direito Constitucional** | **6** | 11–16 | A | 7,5% |
| 4 | Direitos Humanos | 2 | 17–18 | C | 2,5% |
| 5 | Direito Eleitoral | 2 | 19–20 | C | 2,5% |
| 6 | Direito Internacional | 2 | 21–22 | C | 2,5% |
| 7 | Direito Financeiro | 2 | 23–24 | C | 2,5% |
| 8 | **Direito Tributário** | **5** | 25–29 | B | 6,25% |
| 9 | **Direito Administrativo** | **5** | 30–34 | B | 6,25% |
| 10 | Direito Ambiental | 2 | 35–36 | C | 2,5% |
| 11 | **Direito Civil** | **6** | 37–42 | A | 7,5% |
| 12 | ECA | 2 | 43–44 | C | 2,5% |
| 13 | Direito do Consumidor | 2 | 45–46 | C | 2,5% |
| 14 | **Direito Empresarial** | **4** | 47–50 | B | 5,0% |
| 15 | **Processo Civil** | **6** | 51–56 | A | 7,5% |
| 16 | **Direito Penal** | **6** | 57–62 | A | 7,5% |
| 17 | **Direito Processual Penal** | **6** | 63–68 | A | 7,5% |
| 18 | Direito Previdenciário | 2 | 69–70 | C | 2,5% |
| 19 | **Direito do Trabalho** | **5** | 71–75 | B | 6,25% |
| 20 | **Processo do Trabalho** | **5** | 76–80 | B | 6,25% |
| | **TOTAL** | **80** | | | 100% |

Verificação: 8+2+6+2+2+2+2+5+5+2+6+2+2+4+6+6+6+2+5+5 = **80 ✓**

### 6.2 Grupos por ROI estratégico

| Grupo | Questões | % | Disciplinas |
|---|---|---|---|
| **A** — Alto peso | 38 | 47,5% | Ética(8) · Civil(6) · Proc.Civil(6) · Constitucional(6) · Penal(6) · Proc.Penal(6) |
| **B** — Médio peso | 24 | 30,0% | Administrativo(5) · Trabalho(5) · Proc.Trabalho(5) · Tributário(5) · Empresarial(4) |
| **C** — Baixo peso | 18 | 22,5% | 9 disciplinas × 2q cada |

> [REC] **Insight estratégico p/ o planner:** Ética = maior ROI individual (8q fixas, conteúdo fechado, decoreba). Grupo A sozinho ≈ aprovação se bem dominado. O motor pondera **(incidência × fraqueza medida)** — não só fraqueza isolada.

---

## 7. OS 7 SUBSISTEMAS → 4 AMBIENTES

Os subsistemas mapeiam para os 4 ambientes declarados pelo owner [M]:

| Subsistema | Ambiente |
|---|---|
| 1. Aquisição & Banco de Questões + Legislação | Consulta (base) |
| 2. Taxonomia & Tagging (matéria→subtema→micro-tópico + dimensões) | Estudo (base) |
| 3. Motor de Validade Legal (vigente / desatualizada / anulada vs. corte 25/05/2026) | Consulta + Verificação |
| 4. **Ambiente de Teste** — serve prova sem gabarito + timer; ao "finalizar" → libera gabarito → corrige | **Teste** |
| 5. Motor de Correção & Diagnóstico — corrige, detecta fraqueza granular + por dimensão (cross-axis) | **Verificação** |
| 6. Planejador de Estudo — horas/dia → quota de questões + nós-alvo + repetição espaçada | **Estudo** |
| 7. Dashboard & Evolução — acerto por matéria/subtema/dimensão, séries temporais, countdown | Verificação + Estudo |

### 4 Ambientes (verbatim [M])
- **Teste** — provas/simulados cronometrados, sem gabarito; correção pós-finalização
- **Estudo** — rotina dirigida (planner), reforço focado nos micro-tópicos fracos
- **Consulta** — legislação atualizada + banco de questões pesquisável
- **Verificação** — analytics/evolução; leitura "brutal" dos resultados, sem chute

---

## 8. A ESPINHA — MOTOR DE DIAGNÓSTICO

### 8.1 Taxonomia de questão (eixos de etiqueta)

```
EIXO DE CONTEÚDO (hierárquico):
  matéria → subtema → micro-tópico

EIXOS TRANSVERSAIS (conjunto ABERTO — D-06):
  • estilo cognitivo (letra-de-lei · jurisprudência/súmula · caso-concreto · pegadinha/"EXCETO" · interdisciplinar)
  • + QUALQUER outra variável que explique erro:
      exige cálculo? · enunciado longo? · comando negativo (INCORRETA)? ·
      posição na prova (fadiga)? · prazo/numérico? · grau de jurisprudência? ...

+ dificuldade empírica (derivada do % de acerto histórico FGV)
+ validade (vigente / desatualizada / anulada / em-revisão)
```

> [REC] Dimensões transversais iniciam com "estilo cognitivo" como semente. O Motor de Descoberta (§8.3) minera e propõe novas dimensões com base nos erros reais da Kamile.

### 8.2 Schema Postgres / Supabase (esboço)

```sql
materias(id, nome, grupo[A|B|C], questoes_por_prova, posicao_inicio, posicao_fim)
subtemas(id, materia_id, nome)
micro_topicos(id, subtema_id, nome)

-- DIMENSÕES TRANSVERSAIS ABERTAS (adicionar eixo = inserir linha, sem mexer no schema):
dimensoes(id, chave, nome, tipo[categorica|booleana|numerica], descricao)
dimensao_valores(id, dimensao_id, valor)  -- p/ categóricas

exames(id, numero_romano, ano, edicao, data, tipo_prova)
questoes(id, exame_id, num_prova, enunciado, alt_A..D, gabarito,
         materia_id, subtema_id, micro_topico_id?,
         dificuldade, validade_status, validade_motivo, fonte_url)
questao_tags(questao_id, dimensao_id, valor_id?|valor_num?|valor_bool?,
             origem[humano|llm|minerado])  -- N por questão

sessoes(id, user_id, tipo[prova_oficial|simulado|treino], exame_id?, inicio, fim)
respostas(id, sessao_id, questao_id, resposta_dada, correta, tempo_seg, ts)
diagnostico(user_id, eixo, no_id, n_feitas, n_acertos, taxa, tendencia, atualizado_em)
plano_diario(id, user_id, data, horas, questoes_alvo, distribuicao_json, gerado_em)
```

### 8.3 Lógica de diagnóstico e planner

**Diagnóstico:**
- Agrega `respostas` por nó (qualquer eixo/dimensão) → `taxa = acertos/feitas`
- Gate de volume ≥ 8 antes de declarar fraqueza
- **Cross-axis:** taxa por `(subtema × dimensão)` → *"erra Posse quando é caso-concreto"*
- **Weakness score** = `f( (1−taxa), confiança_de_volume, peso_incidência )` → ordena alvos e os nomeia explicitamente

**Planner:**
- Input: horas disponíveis no dia
- Velocidade default: ~30 q/h [REC — calibrável, D-08]
- Output: `"Hoje (3h): 90 questões — 25 Ética, 20 Proc.Penal/Recursos, 15 Posse(caso-concreto)..."`
- Distribuição pondera: incidência × weakness_score
- Injeta repetição espaçada dos micro-tópicos recém-errados
- Garante dose de Ética (alto ROI)

**Motor de Descoberta de Variáveis:**
- Correlação: taxa de erro por valor de cada dimensão → ranqueia preditoras
- Mineração (LLM): lê questões erradas → propõe dimensões candidatas novas
- Loop: dimensão nova → retagueia banco → re-roda diagnóstico

---

## 9. MVP — SEQUENCIAMENTO EM 3 DROPS (recente-first)

> Critério de ordenação: valor para Kamile primeiro, profundidade depois. Respeita D-02 (ingerir tudo), mas prioriza por impacto no combate de 77 dias.

### DROP 1 — Núcleo de Combate (o quanto antes)
- Ingestão das **~10 edições mais recentes** (~800 questões)
- Tag: **matéria + subtema** (mínimo viável para diagnóstico útil)
- Validade: recentes = presumidas vigentes; anuladas marcadas pelo gabarito definitivo
- Ambiente de Teste (prova sem gabarito + timer)
- Correção automática
- Diagnóstico por matéria/subtema
- Dashboard básico: acerto, evolução, **countdown** (77 dias → zero)
- Planner v1 (horas → quota de questões por matéria, baseado em incidência + taxa medida)

**Gate de sucesso:** Kamile consegue fazer uma prova real completa, ver o resultado por matéria, e receber um plano do dia.

### DROP 2 — Profundidade
- Dimensões transversais (estilo + descobertas pelo Motor de Descoberta)
- Micro-tópico no banco recente
- Diagnóstico cross-axis (subtema × dimensão)
- Priorização por incidência refinada com weakness_score completo

### DROP 3 — Histórico + Validade
- Backfill das edições antigas (até 2010, todas 46)
- Motor de Validade Legal completo (check vs. Planalto na data-corte 25/05/2026)
- Selo de validade pleno em todas as questões

### Pós-prova / Fase 2 (futuro)
- Módulo de peças (Tributário) plugando no schema preparado (D-01)

---

## 10. AQUISIÇÃO DE DADOS

[FATO — verificado em `02-RESEARCH`]

- **Provas + gabaritos:** `examedeordem.oab.org.br` e `oab.fgv.br` — PDF gratuito, sem login, 46 edições (2010–2026). Usar **gabarito definitivo** sempre.
- **Legislação:** `planalto.gov.br` (HTML consolidado) — CF, CC, CP, CPC, CPP, CDC, CLT, CTN, ECA, Estatuto OAB, L.9.099.
- **Validade:** âncora = redação vigente em **25/05/2026**. Principais alvos de checagem: questões pré-CPC/2015, pré-Pacote Anticrime/2019, pré-LGPD/2020.
- **Trilhante:** interface de conferência por disciplina, marca questões anuladas.

---

## 11. OUT OF SCOPE (MVP)

- Geração automática de simulados inéditos
- Gabarito comentado por IA por questão (alto valor — drop tardio)
- App mobile nativo
- Módulo de peças da 2ª fase
- Multi-usuário / modo produto vendável

---

## 12. HANDOFF AIOX — SEQUÊNCIA DE AGENTES

1. **@analyst (Atlas)** — Este brief. Fechar item aberto #1 (edital 47).
2. **@pm (Morgan)** — Validar brief, quebrar em épicos/stories por drop, abrir workstream de Descoberta de Variáveis (§8.3).
3. **@architect (Aria)** — Confirmar stack D-03, fechar schema (§8.2), modular os 4 ambientes, definir pipeline de aquisição PDF→questão.
4. **@data-engineer (Dara)** — Pipeline aquisição (PDF→questões), tagging por dimensões abertas (LLM-assistido), Supabase da Kamile (single-user RLS), validade engine + motor de descoberta.
5. **@ux-design-expert (Uma)** — Dashboard desktop-first, fluxo de prova, telas dos 4 ambientes.
6. **@dev (Dex)** — Build incremental por drops.
7. **@qa** — Validar correção contra gabarito + diagnóstico com dados sintéticos.
8. **@devops (Gage)** — Deploy Vercel + Supabase (da Kamile); secrets via `.env`.

> **Ultracode / fan-out:** entra no **tagging em lote** (~3.680 questões): classificadores em paralelo + verificação adversarial do gabarito.

---

## 13. ITENS ABERTOS

| # | Item | Status |
|---|---|---|
| 1 | **Edital 47 (PDF):** confirmar distribuição exata por disciplina | FECHADO — ver `docs/research/edital-47-verification.md` |
| 2 | Dimensões transversais | FECHADO — conjunto aberto + Motor de Descoberta (§8.3) |
| 3 | Stack | FECHADO — D-03 |
| 4 | Nome | FECHADO — Advoga (D-07) |
| 5 | **Velocidade de resolução da Kamile (~30 q/h)** | ABERTO — parâmetro calibrável (D-08). Medir na primeira sessão real |

---

## CHANGELOG

| Data | Evento |
|---|---|
| 2026-06-21 | Draft PRD + braindump + research (mega-brain) |
| 2026-06-21 | D-01..D-07 travadas. Brief congelado para handoff AIOX. |
| 2026-06-21 | Atlas (@analyst): consolidação AIOX-nativa. Item #1 fechado (edital 47). D-08 adicionada (velocidade calibrável). |
