# ADVOGA — Product Requirements Document

> **Versão:** 1.0 · **Data:** 2026-06-21 · **Owner:** Marcos Cezarinni · **Usuária:** Kamile
> **Status:** APROVADO para execução (brief congelado — ver fontes primárias)
> **Prova-alvo:** 47º EOU 1ª fase — **06/09/2026** (77 dias a partir de 21/06/2026)
> **Fontes:** `00-BRAINDUMP-RAW.md` (verbatim autoritativo) · `01-BRIEF.md` (PRD upstream) · `HANDOFF-AIOX.md`
> **Build:** `apps/_active/advoga/` · **DB:** Supabase da Kamile (conta dela, keys via `.env`)

---

## 1. North Star

Um **guia master de estudos OAB 1ª fase, data-driven e pessoal** que diz à Kamile — sem chute, com base em dados de provas reais — **exatamente** onde ela está fraca (até o micro-tópico e o tipo de questão), **quanto** isso pesa na prova, e **o que fazer hoje** com as horas que ela tem.

> Lema verbatim Kamile: *"brutalmente realista, com base em dados... para me forjar brutalmente nessa porra."*

Não é cursinho. É um sistema de forja pessoal.

---

## 2. Contexto e Restrição Dura

| Marco | Data | Observação |
|---|---|---|
| **Prova 1ª fase** | **06/09/2026** | 47º EOU. **77 dias** desde 21/06/2026. Imutável. |
| Corte legislativo | 25/05/2026 | Só lei vigente até esta data é cobrada — âncora do Motor de Validade. |
| 2ª fase (futuro) | 18/10/2026 | Tributário/peças; fora do MVP; arquitetura já preparada (D-01). |

**Consequência direta:** toda decisão de escopo se subordina à pergunta *"isso faz a Kamile resolver mais questões reais com correção granular, mais cedo?"*. Se não, vai para parking lot ou drop tardio.

### Perfil da usuária
- Kamile — concluindo Direito na UCDB, Campo Grande/MS. 1ª tentativa OAB, nunca fez nenhuma fase.
- Autodidata forte: não precisa de ensino de conteúdo; precisa de **diagnóstico e direção**.
- Disponibilidade: **3–4h/dia** focado (variável).
- Dispositivo primário: **desktop/notebook** (prova 80q + gráficos). Celular = consulta rápida.

---

## 3. Princípio Inegociável — Anti-chute (§4 do brief)

Toda afirmação do tipo "você está fraca em X" **deve ser derivada de dados** (respostas dela vs. gabarito), nunca inferida.

- **Gate de volume:** um nó só vira "alvo de reforço" com **≥ 8 questões feitas** no eixo. Abaixo disso: *"amostra insuficiente — vou te dar mais disso para medir."*
- **Fato vs. recomendação:** estatística (acertos/erros) é fato; "estude regra-matriz de incidência" é recomendação, sempre rotulada e rastreável ao dado que a gerou.
- **Sem médias enganosas:** granularidade vence agregados. "82% em Civil" **nunca** esconde "41% em Posse".

---

## 4. Decisões Travadas (não reabrir sem o owner)

| ID | Decisão | Consequência |
|---|---|---|
| D-01 | 1ª fase agora + schema/motor preparados p/ 2ª | Schema e motor acomodam peças/Tributário; UI da 2ª fase só pós-prova. |
| D-02 | Ingerir TUDO + selo de validade. Ordem: recente→antigo | Destino = 46 edições. Motor de Validade Legal vira load-bearing. |
| D-03 | Next.js + Supabase (conta da Kamile) + Vercel | Single-user RLS. Keys via `.env` — **nunca commitar**. |
| D-04 | Desktop-first | Prova de 80q + dashboard p/ tela grande; responsivo p/ consulta. |
| D-05 | Alvo 06/09/2026 — 77 dias | MVP cirúrgico. |
| D-06 | Dimensões transversais = conjunto ABERTO + Motor de Descoberta | Não fixar lista; descobrir TODAS as variáveis que explicam o erro (§8.5 do brief). |
| D-07 | Nome = Advoga | Build home: `apps/_active/advoga/`. |

---

## 5. A Prova (dados que dirigem o motor)

80 questões, 20 disciplinas. Passa com **40 acertos (50%)**.

**Peso oficial por disciplina (incidência — usado pelo planner):**

| Grupo | Disciplinas | Questões | % da prova |
|---|---|---|---|
| **A** | Ética **8** · Civil 6 · Proc. Civil 6 · Constitucional 6 · Penal 6 · Proc. Penal 6 | **38** | **47,5%** |
| **B** | Administrativo 5 · Trabalho 5 · Proc. Trabalho 5 · Tributário 5 · Empresarial 4 | **24** | **30%** |
| **C** | Filosofia · Eleitoral · D. Humanos · Internacional · Financeiro · Ambiental · ECA · Consumidor · Previdenciário (2 cada) | **18** | **22,5%** |

> **Insight estratégico:** Ética = maior ROI da prova. 8 questões fixas, conteúdo fechado, alto percentual de acerto possível. Grupo A sozinho quase garante aprovação se bem dominado. O planner pondera **(incidência × fraqueza dela)** — não só fraqueza isolada.
>
> ⚠️ *Distribuição por disciplina veio de fontes secundárias convergentes; PDF do edital 47 ainda não foi lido direto. Atlas/Dara confirmam no kickoff da Fase 1.*

---

## 6. Requisitos Funcionais

| ID | Requisito | Drop | Fonte |
|---|---|---|---|
| RF-01 | Banco com provas OAB 1ª fase + gabaritos (Drop 1: ~10 edições mais recentes; Drop 3: backfill completo até 2010). | 1 / 3 | M, K |
| RF-02 | Banco de legislação atualizada (Planalto.gov.br consolidado) para consulta e para validar questões contra a data-corte 25/05/2026. | 3 | M |
| RF-03 | Servir prova/simulado SEM gabarito → Kamile responde → finaliza → sistema entrega gabarito → corrige. Timer incluso. | 1 | K |
| RF-04 | Correção automática: acertos/erros por matéria e por subtema. Tagging Drop 1: matéria + subtema. | 1 | K |
| RF-05 | Detecção de fraqueza granular: desce até micro-tópico (Drop 2) e nomeia explicitamente o assunto a reforçar. Gate de volume ≥ 8 antes de declarar fraqueza. | 1 (matéria/subtema) / 2 (micro) | K |
| RF-06 | Detecção por dimensões transversais (estilo de questão e outras variáveis abertas descobertas via §8.5). Cross-axis: taxa por (subtema × dimensão). | 2 | K |
| RF-07 | Análise de incidência: frequência histórica por disciplina e subtema → priorização do planner. | 1 | K |
| RF-08 | Planejador diário: dado X horas hábeis no dia, gerar quota de questões + assuntos-alvo ponderados por (incidência × fraqueza). Dose garantida de Ética (alto ROI). | 1 (v1) | K |
| RF-09 | Dashboard visual de evolução: acerto por matéria/subtema/dimensão ao longo do tempo. Séries temporais. Zero achismo. | 1 | K |
| RF-10 | Contagem regressiva até 06/09/2026 visível no dashboard. | 1 | K |
| RF-11 | Registro persistente de todas as sessões e resultados (histórico auditável). | 1 | K |
| RF-12 | Validade legal das questões: Drop 1 = recentes presumidas vigentes + anuladas marcadas pelo gabarito definitivo. Drop 3 = Motor de Validade completo (check vs. Planalto na data-corte). | 1 (parcial) / 3 (pleno) | K, M |
| RF-13 | Quatro ambientes: Teste, Estudo, Consulta, Verificação. | 1 | M |
| RF-14 | Suporte a simulados além das provas oficiais. | Parking | K |

---

## 7. Requisitos Não-Funcionais

| ID | Requisito | Critério |
|---|---|---|
| NFR-01 | **Anti-chute** | Toda afirmação de fraqueza rastreável a dados. Gate de volume ≥ 8 questões. |
| NFR-02 | **Granularidade** | Taxonomia matéria → subtema → micro-tópico (hierárquico). Dimensões transversais extensíveis via schema `dimensoes/questao_tags`. |
| NFR-03 | **Desktop-first** | Prova de 80 questões e gráficos otimizados para tela ≥ 1280px. Responsivo para consulta. |
| NFR-04 | **Single-user RLS** | Supabase na conta da Kamile. Row Level Security configurado para user_id único. Keys nunca commitadas. |
| NFR-05 | **Atualidade** | Legislação vigente até 25/05/2026. Questões com flag de validade. |
| NFR-06 | **Performance pipeline** | Ingestão de ~800 questões (Drop 1) em batch; sem bloquear UI. |
| NFR-07 | **Extensibilidade** | Schema suporta drop da 2ª fase (peças/Tributário) sem retrabalho no modelo de dados. |
| NFR-08 | **Rastreabilidade** | Todo diagnóstico cita volume de questões que o suporta. Toda recomendação rotulada como inferência. |

---

## 8. Subsistemas (os 7 da plataforma)

1. **Aquisição & Banco** — coleta provas+gabaritos (PDF→estruturado) + legislação; normaliza; versiona. Fontes: FGV/OAB (gabarito definitivo) + Planalto.gov.br.
2. **Taxonomia & Tagging** — etiqueta cada questão (matéria → subtema → micro-tópico + dimensões abertas). LLM-assistido + revisão adversarial.
3. **Motor de Validade Legal** — flag vigente/desatualizada/anulada vs. lei na data-corte 25/05/2026. Load-bearing (D-02).
4. **Ambiente de Teste** — serve prova/simulado sem gabarito + timer; captura respostas; ao "finalizar" libera gabarito e corrige.
5. **Motor de Correção & Diagnóstico** — corrige e detecta fraqueza granular por matéria/subtema/dimensão. Cross-axis (Drop 2). Motor de Descoberta de Variáveis (§8.5 do brief).
6. **Planejador de Estudo** — horas/dia → quota de questões + nós-alvo ponderados por incidência × fraqueza + repetição espaçada + dose de Ética.
7. **Dashboard & Evolução** — desktop-first: acerto por matéria/subtema/dimensão, séries temporais, countdown 06/09/2026.

**Mapeamento para os 4 ambientes da Kamile:**
- **TESTE** → Subsistema 4
- **ESTUDO** → Subsistemas 5 (diagnóstico) + 6 (planner)
- **CONSULTA** → Subsistema 1 (legislação + banco pesquisável)
- **VERIFICAÇÃO** → Subsistemas 5 (correção) + 7 (dashboard)

---

## 9. Modelo de Dados (Esboço — schema §8.2 do brief)

```sql
materias(id, nome, grupo[A|B|C], questoes_por_prova)    -- incidência/peso
subtemas(id, materia_id, nome)
micro_topicos(id, subtema_id, nome)                      -- Drop 2+

-- Dimensões transversais ABERTAS (adicionar eixo = inserir linhas, sem mexer no schema)
dimensoes(id, chave, nome, tipo[categorica|booleana|numerica], descricao)
dimensao_valores(id, dimensao_id, valor)                 -- para categóricas

exames(id, numero_romano, ano, edicao, data, tipo_prova)
questoes(id, exame_id, num_prova, enunciado, alt_A..D, gabarito,
         materia_id, subtema_id, micro_topico_id?,
         dificuldade, validade_status, validade_motivo, fonte_url)
questao_tags(questao_id, dimensao_id, valor_id?|valor_num?|valor_bool?,
             origem[humano|llm|minerado])                -- N tags por questão

sessoes(id, user_id, tipo[prova_oficial|simulado|treino], exame_id?, inicio, fim)
respostas(id, sessao_id, questao_id, resposta_dada, correta, tempo_seg, ts)
diagnostico(user_id, eixo[materia|subtema|micro|<dimensao>], no_id,
            n_feitas, n_acertos, taxa, tendencia, atualizado_em)
plano_diario(id, user_id, data, horas, questoes_alvo, distribuicao_json, gerado_em)
```

Schema detalhado e DDL completo: responsabilidade de Dara (@data-engineer) na Fase 0.3–0.4.

---

## 10. MVP — 3 Drops (sequenciamento)

### DROP 1 — Núcleo de Combate *(prioridade máxima, EP-1)*
- Ingestão das ~10 edições mais recentes (~800 questões), tag matéria + subtema.
- Ambiente de Teste (prova sem gabarito + timer).
- Correção automática.
- Diagnóstico por matéria/subtema (gate ≥ 8 questões).
- Dashboard básico: acerto, evolução, **countdown** 06/09/2026.
- Planner v1: quota diária ponderada por incidência × fraqueza + dose Ética.
- Validade: recentes presumidas vigentes + anuladas marcadas pelo gabarito definitivo.

**DoD Drop 1:** A Kamile consegue abrir uma prova recente real → responder sem ver gabarito → finalizar → ver acertos/erros por matéria e subtema em gráfico → ver quantos dias faltam → receber o plano de questões de hoje dado seu tempo. Ponta-a-ponta com dados reais.

### DROP 2 — Profundidade *(EP-2)*
- Dimensões transversais (estilo + descobertas via Motor de Descoberta §8.5).
- Micro-tópico no banco recente.
- Diagnóstico cross-axis: taxa por (subtema × dimensão).
- Priorização por incidência refinada.

### DROP 3 — Histórico + Validade *(EP-3)*
- Backfill edições antigas (até 2010).
- Motor de Validade Legal completo: check vs. Planalto na data-corte 25/05/2026.
- Selo de validade pleno.

---

## 11. Fora do Escopo MVP / Parking Lot

- Geração automática de simulados inéditos (parking).
- Gabarito comentado por IA por questão (parking — alto valor, drop tardio).
- App mobile nativo.
- Módulo de peças da 2ª fase (pós-prova; schema preparado).
- Multi-usuário / modo produto vendável (futuro; arquitetura não impede).

---

## 12. Stack e Infraestrutura

| Camada | Decisão |
|---|---|
| Frontend | Next.js + React + TypeScript + Tailwind + Zustand |
| Backend | Next.js API Routes / Server Actions |
| Banco | Supabase PostgreSQL (conta da Kamile — single-user RLS) |
| Deploy | Vercel |
| Secrets | `.env` local + Vercel env vars. Nunca commitar. |
| Tagging em lote | Pipeline LLM-assistido (ultracode fan-out, Drop 1: ~800q, Drop 3: ~2.880q restantes) |

---

## 13. Itens Abertos

1. **Edital 47 (PDF oficial):** confirmar distribuição exata de questões por disciplina. → Atlas/Dara no kickoff da Fase 1.
2. **Velocidade de resolução da Kamile** (~30 q/h default): calibrável; só afeta o planner.
3. **Lista-semente de dimensões transversais** (§8.1): ponto de partida; refina via Motor de Descoberta com o uso real.
4. **Supabase da Kamile:** `PROJECT_REF` + `anon`/`service_role` keys necessários para Fase 1. Owner fornece no setup.

---

## 14. Success Metrics — Drop 1

| Métrica | Critério |
|---|---|
| Ponta-a-ponta funcional | Kamile completa um fluxo completo (prova → correção → diagnóstico → planner) sem erro |
| Dados reais | ≥ 10 edições ingeridas (~800 questões) com tag matéria/subtema no Supabase dela |
| Diagnóstico honesto | Gate de volume ≥ 8 implementado; nenhuma fraqueza declarada sem amostra suficiente |
| Countdown | Data 06/09/2026 visível na homepage do dashboard |
| Planner v1 | Dado X horas, retorna distribuição diária ponderada por incidência × fraqueza + Ética |

---

## CHANGELOG

| Data | Evento |
|---|---|
| 2026-06-21 | PRD AIOX v1.0 gerado por Morgan (@pm) a partir de `01-BRIEF.md` + `HANDOFF-AIOX.md` + `00-BRAINDUMP-RAW.md`. |
