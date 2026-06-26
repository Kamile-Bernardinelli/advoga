# EP-2 — Depth: Profundidade (Drop 2)

> **Épico:** 2 · **Título:** Depth — Drop 2: Dimensões Transversais, Micro-tópico, Cross-axis, Motor de Descoberta
> **Fase AIOX:** FASE 2 — Drop 2
> **Status:** Draft
> **Agentes responsáveis:** Dara (@data-engineer) · Dex (@dev) · Uma (@ux-design-expert)
> **PRD Trace:** PRD.md §10 (Drop 2), RF-05, RF-06, §8.1, §8.3, §8.5 do brief
> **Dependência:** EP-1 concluído (dados Drop 1 no Supabase, banco de respostas reais da Kamile)

---

## Objetivo

Adicionar profundidade ao sistema: micro-tópico como terceiro nível de granularidade, dimensões transversais (estilo de questão e outras variáveis abertas), diagnóstico cross-axis (subtema × dimensão) e o Motor de Descoberta de Variáveis — que minera os erros da Kamile e propõe novas dimensões explicativas.

Este épico transforma o Advoga de "app de diagnóstico" em sistema inteligente que fica mais preciso quanto mais a Kamile usa.

---

## Escopo

### Inclui
- Tagging de micro-tópico nas questões das ~10 edições recentes (retroativo via pipeline).
- Dimensões transversais: lista-semente inicial (ex.: estilo cognitivo — letra-de-lei / jurisprudência / caso-concreto / pegadinha / interdisciplinar) + schema extensível via `dimensoes` e `questao_tags`.
- Motor de Descoberta de Variáveis (§8.5 do brief):
  - Correlação: medir taxa de erro por valor de CADA dimensão tagueada → ranquear as que mais predizem erro da Kamile.
  - Mineração LLM: ler questões que a Kamile errou → propor dimensões candidatas novas → viram dimensões taggáveis.
  - Loop: dimensão nova → retagueia banco → re-roda diagnóstico.
- Diagnóstico cross-axis: taxa por (subtema × dimensão) — ex.: "erra Posse quando é caso-concreto; acerta letra de lei".
- Dashboard atualizado: visualização de progresso por dimensão além de matéria/subtema.
- Priorização refinada por incidência (dados mais precisos após Drop 1 de uso real).

### Não inclui
- Backfill de edições antigas (EP-3).
- Motor de Validade Legal completo (EP-3).
- Gabarito comentado por IA (parking).

---

## Acceptance Criteria (Alto Nível)

### Micro-tópico (RF-05 ampliado)
- [ ] AC-2.1: Questões das 10 edições recentes tagueadas com `micro_topico_id`. Pipeline reproduzível.
- [ ] AC-2.2: Diagnóstico desce até micro-tópico quando volume ≥ 8. Gate de volume aplicado em cada nível (matéria → subtema → micro-tópico) independentemente.
- [ ] AC-2.3: Fraqueza de micro-tópico nomeada explicitamente (ex.: "Direito das Coisas > Posse > Posse direta vs. indireta").

### Dimensões Transversais (RF-06)
- [ ] AC-2.4: Lista-semente de dimensões inserida na tabela `dimensoes` (mínimo: estilo cognitivo com 5 valores). Extensível sem mudança de schema.
- [ ] AC-2.5: Questões das 10 edições recentes tagueadas em `questao_tags` para as dimensões da lista-semente.
- [ ] AC-2.6: Diagnóstico por dimensão disponível (taxa de acerto por valor de cada dimensão).

### Cross-axis (RF-06 + §8.3 do brief)
- [ ] AC-2.7: Dashboard exibe taxa de acerto por (subtema × dimensão). Ex.: "Em Posse + caso-concreto: 35%. Em Posse + letra-de-lei: 71%."
- [ ] AC-2.8: Planner v2 incorpora resultado cross-axis: alvo do dia pode ser "matéria X no estilo Y".

### Motor de Descoberta (§8.5 do brief)
- [ ] AC-2.9: Pipeline de correlação executa sob demanda: ranqueia dimensões por poder preditivo de erro da Kamile.
- [ ] AC-2.10: Pipeline de mineração LLM produz lista de dimensões candidatas novas com justificativa baseada em padrões observados.
- [ ] AC-2.11: Workflow para Marcos/Kamile aprovar dimensão candidata → inserir em `dimensoes` → re-taguear banco → re-rodar diagnóstico.

---

## Dependências

- **Requer:** EP-1 concluído + banco de respostas reais da Kamile (mínimo: 2–3 sessões, ~160–240 respostas) para o Motor de Descoberta ter dados para minerar.
- **Bloqueia:** EP-3 (o Motor de Descoberta é a fundação do diagnóstico avançado que vai ao histórico completo).

---

## Definição de Pronto

- Micro-tópico tagueado nas 10 edições recentes, diagnóstico funcionando no terceiro nível.
- Pelo menos 1 dimensão transversal além de matéria/subtema ativa e diagnósticável.
- Cross-axis funcionando: Kamile pode ver "erro no estilo X da matéria Y".
- Motor de Descoberta executou ao menos 1 ciclo completo (correlação + mineração + aprovação de dimensão nova).
- @qa validou que o gate de volume ≥ 8 funciona em todos os três níveis (matéria, subtema, micro-tópico).

---

## CHANGELOG

| Data | Evento |
|---|---|
| 2026-06-21 | EP-2 criado por Morgan (@pm) — Drop 2 Depth. |
