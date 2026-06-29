---
name: advoga-incidencia-display
description: Painel /incidencia (Incidência & Tendência por subtema) + veredito de que NÃO há rotação da FGV — display é descritivo, nunca preditivo
metadata:
  type: project
---

Painel "Incidência & Tendência por Subtema" no ambiente `(verificacao)` — a "inteligência de dados visível" que o Marcos pediu. Fonte: `v_incidencia_subtema` (cumulativa, ranking) + `v_tendencia_subtema` (série por edição). Spec: `docs/architecture/trend-display-spec.md`. Veredito da análise: `docs/analysis/tendencia-subtema-findings.md`.

**VEREDITO TRAVADO (data-backed, não re-litigar):** a hipótese de rotação ~3 anos da FGV foi TESTADA (teste de permutação, 5000×, duas margens fixas) e REJEITADA. A incidência por subtema é estável — o movimento observado é igual ou MENOR que o do acaso. Célula típica = 1 questão (ruído ≈ sinal).

**Why:** se alguém pedir um "peso de tendência" no planner, um feature "qual subtema vai cair", ou colorir subtemas por subir/descer — isso ajustaria RUÍDO e pioraria a priorização. O findings §7 recomenda explicitamente NÃO adicionar peso de rotação; recência já está resolvida pela escolha da janela (só ed37–46 ingeridas).

**How to apply:** qualquer display/feature sobre incidência é DESCRITIVO ("o que já caiu"), nunca PREDITIVO ("o que vai cair"). Anti-chute: sparkline monocromática, zeros densificados, normalização global, banner honesto acima dos dados, sem rótulo de alta/queda por subtema. O planner continua usando `v_incidencia_subtema.n_questoes` como `pesoIncidencia` puro (sem tilt temporal). Relaciona-se a [[advoga-drop25-subtema]] e [[advoga-diagnostico-eav]] (mesma disciplina anti-chute: veredito só com amostra ≥ gate).
