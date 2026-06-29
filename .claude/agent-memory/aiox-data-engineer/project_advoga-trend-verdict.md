---
name: advoga-trend-verdict
description: Verdict on FGV rotation hypothesis — NOT supported; planner must use cumulative incidence, not a trend/decay weight.
metadata:
  type: project
---

Marcos hipotetizou que a FGV ROTACIONA subtemas num ciclo ~3 anos; Kamile dizia que a
incidência é estável e o que importa é recência. **Testado em 2026-06-28 → rotação NÃO
SUPORTADA.** Kamile estava certa.

**Why:** decide se o cronograma planner deve ganhar um peso de tendência/decay. A resposta
é NÃO — não há tendência a explorar; um peso desses ajustaria a ruído e pioraria a
priorização.

**Evidência (anti-chute, teste de permutação 5000× com margens fixas, 2 nulos):** sobre os
75 subtemas em ≥4 edições (janela ed38–46, 8 edições, ~2.5 anos), TODA medida de movimento
temporal (nº rising/falling, energia de slope, maior |slope|) ficou no piso ou ABAIXO do
percentil 5 do ruído. O subtema mais extremo tinha |slope|=0.19; o acaso sozinho gera máx
médio 0.36. A célula típica (subtema×edição) vale 1 questão (máx 3) → ruído≈sinal. Cota por
MATÉRIA é quase determinística (var/média 0.0–0.14; Tributário literalmente 5,5,5,5,5,5,5,5)
→ sem rotação entre disciplinas. Janela de 2.5 anos não comporta nem 1 ciclo de 3 anos.

**How to apply:**
- `pesoIncidencia` do planner = `v_incidencia_subtema.n_questoes` (cumulativo). NÃO criar
  peso de tendência/decay. Se exigirem, α ≤ 0.15, só acima do gate de amostra (=8), e só se
  o efeito bater o nulo de permutação (hoje nenhum bate → α=0).
- Recência já está tratada pela JANELA (só ed37–46 ingeridas), não por peso temporal. Ver [[advoga-ep0-alignment]].
- View criada: `public.v_tendencia_subtema` (migration 20260628201154, security_invoker=on) —
  decomposição temporal de v_incidencia_subtema. É para EXIBIÇÃO/monitoramento, não para peso.
- Reabrir o veredito só com ~6+ anos de edições e células ≥2 em média. ed37/40 faltam mas
  +2 pontos não mudam nada.
- Relatório completo: `docs/analysis/tendencia-subtema-findings.md`.
