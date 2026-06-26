---
name: advoga-oab-taxonomy
description: Advoga é sistema de estudos OAB 1ª fase (usuária Kamile); taxonomia jurídica seed + âncoras de validade legislativa (corte 25/05/2026)
metadata:
  type: project
---

Advoga = sistema data-driven de estudos para a 1ª fase OAB (47º EOU, prova 06/09/2026), usuária Kamile, owner Marcos. Stack Next.js + Supabase (conta da Kamile) + Vercel, single-user RLS. Build local-first.

Entreguei a taxonomia jurídica seed em `docs/taxonomy/oab-1fase-taxonomy.md`: 20 matérias (grupos A/B/C, pesos de incidência), 192 subtemas, 63 micro-tópicos (semente Drop 2), 12 dimensões transversais (conjunto ABERTO) + 6 valores. Mapeia 1:1 no schema §8.2 (materias/subtemas/micro_topicos/dimensoes/dimensao_valores). Slug = chave estável snake_case sem acento.

**Why:** Fase 0 do projeto; vira SQL seed do banco e espinha do diagnóstico granular (motor pondera incidência × fraqueza). Corte legislativo é 25/05/2026 (edital) — só lei vigente até aí é cobrável.

**How to apply:** Ao revisitar Advoga, a taxonomia é a fonte da estrutura de conteúdo. O **Motor de Validade (Drop 3)** consome a tabela REFORM-WATCH (§5 do doc) + tag `reform_sensitive=true`. Âncoras críticas: CPC/2015, Pacote Anticrime/2019 (juiz das garantias mandatório por STF ADI 6298), Reforma Trabalhista/2017, Lei 14.133/2021 (licitações), EC 132/2023+LC 214/2025 (reforma tributária — 2026 é só TESTE, cobrança 2027). **Armadilha inversa:** PL 4/2025 (novo Código Civil) NÃO é lei no corte (votação prevista jul/2026) — CC/2002 segue íntegro; material que trate o PL como lei é inválido para o 47º EOU. Correções de nomenclatura vs research: disciplina 1 = "Estatuto da Advocacia e da OAB, Regulamento Geral e CED" (não só "Ética"); distribuição R-04 confirmada (soma 80, sem erro de peso).
