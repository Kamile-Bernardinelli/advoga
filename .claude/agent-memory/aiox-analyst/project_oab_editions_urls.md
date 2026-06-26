---
name: project-oab-editions-urls
description: URLs verificadas (HTTP 200) de provas Tipo 1 e gabaritos definitivos das edições 37-46 do OAB 1ª fase — alimenta pipeline de ingestão
metadata:
  type: project
---

JSON salvo em `/Users/admin/code/apps/_active/advoga/data/sources/oab-editions.json`.

**Resultado:** 10/10 completas (prova + gabarito, ambos HTTP 200).

**Why:** Pipeline de ingestão do sistema de estudos da Kamile precisa dos PDFs oficiais para parsear questões e gabaritos. URLs foram verificadas via curl -sI.

**How to apply:** Usar JSON como fonte de verdade para download. Parser calibrado para Tipo 1 (CNS01). Para 46, usar gabarito definitivo `0662d6ed` (s.oab.org.br), não o `338854` do FGV que é o preliminar.

## Padrão de chaves FGV por edição
arq/640 = 37, arq/641 = 38, arq/642 = 39, arq/643 = 40, arq/644 = 41, arq/645 = 42, arq/646 = 43, arq/647 = 44, arq/648 = 45, arq/649 = 46

## Observações críticas
- Edições 38, 39, 43, 44, 46: provas em s.oab.org.br (não no FGV diretamente)
- Edição 44: arq/647 só tem Tipo 4 indexado pelo Google — Tipo 1 está APENAS em s.oab.org.br
- Gabarito 46: oab.fgv.br/arq/649/338854 = PRELIMINAR. Definitivo = s.oab.org.br/arquivos/2026/05/0662d6ed
- Gabarito 37: s.oab.org.br/arquivos/2023/03/6482394e (combina gabarito + resultado — é o único link oficial publicado)
