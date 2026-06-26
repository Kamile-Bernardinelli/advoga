# EP-1 — Combat Core: Núcleo de Combate (Drop 1)

> **Épico:** 1 · **Título:** Combat Core — Drop 1: Ingestão, Teste, Diagnóstico, Dashboard, Planner
> **Fase AIOX:** FASE 1 — Drop 1
> **Status:** Draft
> **Agentes responsáveis:** Dara (@data-engineer) · Uma (@ux-design-expert) · River (@sm) · Dex (@dev) · Quinn (@qa) · Gage (@devops)
> **PRD Trace:** PRD.md §10 (Drop 1), §6 (RF-01..RF-13), HANDOFF §8 (DoD Drop 1)
> **Dependência:** EP-0 concluído (schema no ar, projeto deployável)

---

## Objetivo

Entregar o **núcleo de combate** da Kamile: ela consegue fazer uma prova real da OAB sem ver o gabarito, finalizar, ver o diagnóstico por matéria/subtema, ver o countdown até 06/09/2026 e receber o plano de questões do dia. Ponta-a-ponta, com dados reais.

> **DoD Drop 1 (verbatim HANDOFF §8):** A Kamile consegue: abrir uma prova recente real → respondê-la sem ver gabarito → finalizar → ver quantas acertou/errou **por matéria e subtema** em gráfico → ver **quantos dias faltam** → receber **o plano de questões de hoje** dado seu tempo. Se isso funciona ponta-a-ponta com dados reais, Drop 1 está pronto.

---

## Escopo

### Inclui
- Pipeline de aquisição: PDF→estruturado para as ~10 edições mais recentes da OAB (~800 questões). Fontes: FGV/OAB portais públicos, gabarito definitivo.
- Tagging Drop 1: matéria + subtema (micro-tópico = Drop 2).
- Validade Drop 1: recentes presumidas vigentes + anuladas marcadas pelo gabarito definitivo FGV.
- Ambiente de Teste: servir prova sem gabarito + timer + captura de respostas + liberação de gabarito ao finalizar.
- Correção automática: acertos/erros por matéria e subtema.
- Motor de diagnóstico Drop 1: taxa de acerto por matéria/subtema. Gate de volume ≥ 8 questões antes de declarar fraqueza.
- Dashboard Drop 1: acerto por matéria/subtema + séries temporais + **countdown** 06/09/2026.
- Planner v1: dado X horas → quota de questões distribuída por (incidência × fraqueza). Dose garantida de Ética (8q, alto ROI).

### Não inclui (vai para EP-2 ou EP-3)
- Dimensões transversais além de matéria/subtema.
- Micro-tópico como eixo de diagnóstico.
- Diagnóstico cross-axis (subtema × dimensão).
- Motor de Descoberta de Variáveis.
- Motor de Validade Legal completo (check vs. Planalto).
- Backfill de edições antigas (Drop 3).
- Ambiente de Consulta completo (legislação Planalto).
- Gabarito comentado por IA.

---

## Acceptance Criteria (Alto Nível)

### Pipeline de Ingestão (RF-01)
- [ ] AC-1.1: ≥ 10 edições OAB recentes ingeridas (~800 questões). Questões com campos: enunciado, alternativas A-D, gabarito definitivo, matéria, subtema, fonte_url, validade_status.
- [ ] AC-1.2: Anuladas identificadas e marcadas (`validade_status = 'anulada'`) conforme gabarito definitivo FGV.
- [ ] AC-1.3: Script de ingestão reproduzível (não depende de execução manual de SQL).

### Ambiente de Teste (RF-03)
- [ ] AC-1.4: Kamile seleciona uma prova, responde 80 questões sem ver gabarito. Timer visível. Salva em `sessoes`.
- [ ] AC-1.5: Ao clicar "Finalizar", gabarito é liberado e `respostas` são gravadas com `correta = true/false`.
- [ ] AC-1.6: Questões anuladas exibidas com badge "Anulada" e não penalizam a taxa de acerto.

### Correção & Diagnóstico (RF-04, RF-05, RF-07)
- [ ] AC-1.7: Após finalizar, relatório mostra acertos/erros por matéria e por subtema em gráfico de barras.
- [ ] AC-1.8: Gate de volume ≥ 8 implementado: subtemas com < 8 respostas exibem "amostra insuficiente" em vez de diagnóstico de fraqueza.
- [ ] AC-1.9: Fraqueza declarada nomeia o subtema explicitamente (ex.: "Direito das Coisas > Posse") — nunca só porcentagem sem contexto.

### Dashboard (RF-09, RF-10, RF-11)
- [ ] AC-1.10: Dashboard mostra countdown até 06/09/2026 em dias na homepage.
- [ ] AC-1.11: Evolução temporal: gráfico de taxa de acerto por matéria ao longo das sessões.
- [ ] AC-1.12: Histórico de sessões listado e acessível.

### Planner v1 (RF-08)
- [ ] AC-1.13: Kamile informa horas disponíveis hoje → sistema retorna quota de questões (default ~30 q/h) distribuída por matéria ponderando (incidência × fraqueza).
- [ ] AC-1.14: Ética sempre inclusa na distribuição do planner (dose mínima proporcional ao ROI de 8q fixas).
- [ ] AC-1.15: Plano do dia salvo em `plano_diario` com `distribuicao_json`.

---

## Stories do Drop 1

| Story | Título | Agente |
|---|---|---|
| 1.1 | Ingestion Pipeline | Dara + ultracode |
| 1.2 | Test Environment | Dex |
| 1.3 | Auto-correction Engine | Dex |
| 1.4 | Diagnostics Materia/Subtema | Dex |
| 1.5 | Dashboard + Countdown | Dex + Uma |
| 1.6 | Planner v1 | Dex |

Stubs em `docs/stories/1.x.*.story.md`.

---

## Dependências

- **Requer:** EP-0 concluído (schema + RLS + Supabase da Kamile no ar).
- **Requer (externo):** Keys do Supabase da Kamile (owner fornece).
- **Bloqueia:** EP-2 (precisa dos dados tagueados da Drop 1 para adicionar dimensões transversais).

---

## Definição de Pronto

- DoD verbatim do HANDOFF §8 satisfeito: fluxo completo ponta-a-ponta funcional com dados reais.
- ≥ 10 edições ingeridas e tagueadas (matéria + subtema) no Supabase da Kamile.
- Countdown visível no dashboard.
- Planner v1 retornando distribuição ponderada.
- Gate de volume ≥ 8 funcionando (nenhuma fraqueza declarada sem amostra).
- @qa validou correção contra gabarito com dados sintéticos.
- Deploy Vercel: Drop 1 live para a Kamile acessar.

---

## CHANGELOG

| Data | Evento |
|---|---|
| 2026-06-21 | EP-1 criado por Morgan (@pm) — Drop 1 Combat Core. |
