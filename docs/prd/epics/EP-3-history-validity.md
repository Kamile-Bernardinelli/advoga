# EP-3 — History + Validity: Histórico Completo e Validade Legal (Drop 3)

> **Épico:** 3 · **Título:** History + Validity — Drop 3: Backfill 46 edições + Motor de Validade Legal
> **Fase AIOX:** FASE 3 — Drop 3
> **Status:** Draft
> **Agentes responsáveis:** Dara (@data-engineer) · ultracode (fan-out tagging em lote) · Dex (@dev)
> **PRD Trace:** PRD.md §10 (Drop 3), RF-01, RF-02, RF-12, §8 do brief, §5 do HANDOFF (ultracode)
> **Dependência:** EP-1 concluído. EP-2 recomendado (Motor de Descoberta disponível para o backfill).

---

## Objetivo

Completar o banco histórico (todas as ~46 edições FGV, ~3.680 questões), aplicar o Motor de Validade Legal completo (check contra a redação vigente no Planalto em 25/05/2026) e garantir que o diagnóstico da Kamile tenha toda a incidência histórica disponível para ponderação.

Este épico é o "modo hardcore": após a prova de 06/09/2026 ou antes se o tempo permitir. Não é pré-requisito para a Kamile começar a estudar.

---

## Escopo

### Inclui
- Backfill de ~36 edições restantes (além das 10 do Drop 1), do mais recente para o mais antigo (recente→antigo, D-02).
- Tagging em lote via ultracode (fan-out de classificadores): matéria + subtema + micro-tópico + dimensões transversais (sementes do EP-2) + validade.
- Verificação adversarial: agente confirma que `gabarito` casa com fonte FGV definitiva; flag divergências e anulações.
- **Motor de Validade Legal completo:**
  - Para cada questão com dispositivo legal citado: cruzar contra a redação vigente no Planalto.gov.br em 25/05/2026.
  - Classificar: `vigente | desatualizada | anulada | em-revisão`.
  - Flag especial para questões pré-reformas críticas: CPC/2015, Pacote Anticrime/2019, LGPD/2020.
- Banco de legislação consolidada: CF, CC, CP, CPC, CPP, CDC, CLT, CTN, ECA, Estatuto OAB, L.9.099 (Planalto.gov.br).
- Ambiente de Consulta completo: banco de questões pesquisável + legislação acessível via UI.
- Atualização do diagnóstico com incidência baseada no histórico completo.

### Não inclui
- UI da 2ª fase OAB (módulo de peças/Tributário — schema preparado em EP-0).
- Geração automática de simulados inéditos (parking).
- Gabarito comentado por IA (parking).

---

## Acceptance Criteria (Alto Nível)

### Backfill (RF-01)
- [ ] AC-3.1: Todas as edições FGV disponíveis ingeridas (~46 edições, ~3.680 questões). Campo `fonte_url` preenchido por questão.
- [ ] AC-3.2: Pipeline de tagging em lote executado via ultracode (4 stages: classificação → verificação adversarial → validade → descoberta). Reproduzível.
- [ ] AC-3.3: Todas as questões têm `materia_id`, `subtema_id`, `micro_topico_id` preenchidos. Sem nulls nestas colunas.

### Motor de Validade Legal (RF-12)
- [ ] AC-3.4: Toda questão tem `validade_status` preenchido: `vigente | desatualizada | anulada | em-revisão`.
- [ ] AC-3.5: Questões pré-CPC/2015, pré-Pacote Anticrime/2019 e pré-LGPD/2020 revisadas com flag específico quando o dispositivo mudou.
- [ ] AC-3.6: UI: questão desatualizada exibe badge "Desatualizada" com `validade_motivo` acessível. Não penaliza taxa de acerto da Kamile se ela acertar a resposta histórica vs. a atual.

### Banco de Legislação (RF-02)
- [ ] AC-3.7: ≥ 10 códigos/leis do Planalto.gov.br indexados e pesquisáveis na UI (Ambiente de Consulta).
- [ ] AC-3.8: Legislação com data de vigência rastreável para suportar o Motor de Validade.

### Ambiente de Consulta (RF-13)
- [ ] AC-3.9: Kamile consegue pesquisar questões por matéria, subtema, edição, validade_status e texto-livre.
- [ ] AC-3.10: Kamile consegue acessar o texto consolidado de uma lei a partir da UI.

### Diagnóstico com histórico completo
- [ ] AC-3.11: Análise de incidência usa o banco completo (46 edições). Frequência por matéria/subtema/micro-tópico recalculada.
- [ ] AC-3.12: Planner v3 atualizado com incidência histórica completa.

---

## Dependências

- **Requer:** EP-1 concluído (schema, pipeline base, RLS).
- **Recomenda:** EP-2 (Motor de Descoberta disponível para Stage 4 do ultracode).
- **Bloqueia:** Nenhum épico futuro dentro do MVP. Módulo de 2ª fase (Tributário/peças) pode plugar independentemente após este.

---

## Definição de Pronto

- Banco completo: ~3.680 questões ingeridas, tagueadas, com validade_status preenchido.
- Motor de Validade Legal: toda questão classificada como `vigente | desatualizada | anulada | em-revisão`.
- Ambiente de Consulta: legislação + banco pesquisável funcionando.
- Diagnóstico com incidência histórica completa disponível.
- @qa validou sample de 50+ questões de validade contra Planalto manualmente.
- @devops deploy Vercel do Drop 3 funcionando.

---

## CHANGELOG

| Data | Evento |
|---|---|
| 2026-06-21 | EP-3 criado por Morgan (@pm) — Drop 3 History + Validity. |
