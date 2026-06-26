---
name: advoga-diagnostico-eav
description: Decisão de arquitetura do motor de diagnóstico do Advoga — dimensões ABERTAS via EAV, views SQL genéricas (não uma por dimensão), gate de volume >=8 em duas camadas
metadata:
  type: project
---

O motor de diagnóstico do Advoga agrega `respostas` por nó de QUALQUER eixo. Eixo de conteúdo (matéria→subtema→micro) = colunas diretas em `questoes`. Eixos transversais = **conjunto ABERTO** via EAV (`dimensoes`/`dimensao_valores`/`questao_tags`) — D-06.

**Decisão-chave (consequência do conjunto aberto):** o motor usa **um conjunto pequeno de views SQL GENÉRICAS** que agregam `respostas ⨝ questao_tags` por `dimensao_id`+`valor` — **NUNCA uma view por dimensão**. Adicionar um eixo novo = inserir linhas em `dimensoes`/`questao_tags`, ZERO mudança em view ou código. As 3 views: `v_diagnostico_conteudo`, `v_diagnostico_dimensao`, `v_diagnostico_cross` (subtema×dimensão — "erra Posse quando é caso-concreto").

**Why:** o Motor de Descoberta de Variáveis (§8.5 do brief) descobre dimensões novas em runtime e re-tagueia o banco. Se o motor hardcodasse dimensões, cada descoberta exigiria migration+deploy. Genérico desde o Drop 1 é o que torna o produto "mais que um cursinho".

**Gate anti-chute >=8 em DUAS camadas (defense in depth):** na view (`volume_ok = count(*)>=8`) E no app (`lib/diagnostico/weakness-score.ts` retorna `null` abaixo do gate). weakness score = `(1−taxa) * confiança_volume * peso_incidência`, calibrável no app (sem migration). Estatística=fato; "estude X"=recomendação rotulada rastreável ao dado (§4 do brief).

**How to apply:** ao mexer no diagnóstico, manter views genéricas e o gate nas duas camadas. Onde mora: agregação em SQL views (set-based, perto do dado); pesos/score no app (calibrável). Materialized view só se medir lentidão (escala single-user é pequena).

Pedidos formais ao @data-engineer estão em `docs/architecture/fullstack-architecture.md` §7 (D-1..D-9). Schema canônico = §8.2 do brief. Ver [[advoga-core]].
