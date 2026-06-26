---
name: advoga-project-context
description: Contexto central do projeto Advoga — guia OAB 1ª fase para Kamile. Datas, decisões travadas, distribuição de questões e estado do brief.
metadata:
  type: project
---

Projeto Advoga: guia de estudos OAB 1ª fase para Kamile (namorada do Marcos), data-driven, single-user, build em `apps/_active/advoga/`.

**Why:** Kamile faz o 47º EOU em 06/09/2026 (77 dias a partir de 21/06/2026). Sistema tem que ser usável em dias, não semanas.

**How to apply:** Qualquer decisão de escopo é subordinada a "isto faz a Kamile resolver mais questões reais com correção granular, mais cedo?". MVP recente-first em 3 drops.

## Decisões travadas (D-01..D-08)
- D-01: 1ª fase agora + arquitetura pronta p/ 2ª
- D-02: Ingerir tudo (46 edições) + selo de validade, ordem recente→antigo
- D-03: Next.js + Supabase (conta da KAMILE) + Vercel. Keys via .env, nunca commitar.
- D-04: Desktop-first
- D-05: Data 06/09/2026, corte legislativo 25/05/2026
- D-06: Dimensões transversais = conjunto ABERTO + Motor de Descoberta
- D-07: Nome = Advoga
- D-08: Velocidade ~30 q/h é parâmetro CALIBRÁVEL (não fato medido) — medir na 1ª sessão real

## Distribuição OAB 47 (confirmada, sem divergência vs R-04)
20 disciplinas, 80q. Grupo A (38q): Ética(8), Civil(6), Proc.Civil(6), Constitucional(6), Penal(6), Proc.Penal(6). Grupo B (24q): Adm(5), Trabalho(5), Proc.Trabalho(5), Tributário(5), Empresarial(4). Grupo C (18q): 9 disciplinas × 2.

## Estado dos docs (2026-06-26 — atualizado)
- `docs/00-project-brief.md` — Brief AIOX-nativo consolidado (CONGELADO para handoff)
- `docs/research/edital-47-verification.md` — Verificação item aberto #1 (PDF não legível, distribuição confirmada via fontes secundárias)
- `docs/research/edital-47-ingested.md` — NOVO: ingestão estruturada do edital 47 (cronograma 22 marcos, regras 1ª fase, confirmação ausência syllabus detalhado 1ª fase, Anexo II 2ª fase rotulado)
- `data/sources/edital-47-marcos.json` — NOVO: array JSON de 27 marcos {evento, data YYYY-MM-DD, fase, fonte} para consumo do dashboard

## Gap remanescente
Annexo II do edital tem artefato de conversão PDF→MD: Direito do Trabalho está embutido na seção "Direito Civil". Conteúdo identificável por tópicos (jornada, FGTS, sindicato, etc.), mas sem cabeçalho separado no MD. Correto no edital PDF original.
