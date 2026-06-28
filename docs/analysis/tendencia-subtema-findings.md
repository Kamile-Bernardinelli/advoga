# Tendência de subtema — existe rotação da FGV? (análise temporal)

**Autor:** Dara (@data-engineer) · **Data:** 2026-06-28 · **Janela:** ed38–ed46 (8 edições, 2023-07 → 2026-01)
**View criada:** `public.v_tendencia_subtema` (migration `20260628201154_tendencia_subtema.sql`, APLICADA na cloud)

---

## VEREDITO (TL;DR)

> **A hipótese de rotação ~3 anos da FGV NÃO É SUPORTADA pelos dados.**
> A incidência por subtema é **estável** — mais estável, inclusive, do que o acaso produziria.
> A posição da Kamile ("incidência é estável, o que importa é recência") é a que os dados sustentam.
>
> **Recomendação ao planner: NÃO adicionar peso de tendência.** Manter incidência cumulativa
> (`v_incidencia_subtema.n_questoes`) como `pesoIncidencia`. A recência já está corretamente
> tratada pela **escolha da janela** (só ed37–46 ingeridas), não por um peso temporal.

Importante separar duas decisões que costumam ser confundidas:
- **Usar janela recente (ed37–46): correto** — porque a lei/estilo mudam (recência). Isso já está feito.
- **Usar um peso de *rotação/tendência*: incorreto** — porque não há rotação a explorar; um peso
  desses ajustaria a RUÍDO e pioraria a priorização.

---

## 1. O que foi construído (deliverable)

`public.v_tendencia_subtema` — uma linha por par **(subtema × edição cobrada)**:

| coluna | origem |
|---|---|
| `subtema_id`, `subtema_nome` | `subtemas` |
| `materia_id`, `materia_nome` | `materias` |
| `exame_numero` | `exames.edicao` (eixo temporal) |
| `ano` | `exames.ano` |
| `n_questoes` | `COUNT(questoes)` do subtema naquela edição |

- `WITH (security_invoker=on)` (padrão D-6).
- Aditiva (`CREATE OR REPLACE VIEW`), aplicada e verificada: **551 linhas, 158 subtemas, 8 edições, soma = 640** (bate com o total de questões).
- É a decomposição temporal de `v_incidencia_subtema` (cumulativa). Só emite **células não-zero**;
  par (subtema, edição) ausente = 0 questões. Quem montar série temporal **deve densificar os zeros**.

```sql
SELECT exame_numero, ano, n_questoes
FROM public.v_tendencia_subtema
WHERE subtema_nome = '...'
ORDER BY exame_numero;
```

---

## 2. A realidade dos dados (por que cautela é obrigatória)

| fato | valor |
|---|---|
| Edições presentes | 38, 39, 41, 42, 43, 44, 45, 46 (faltam 37 e 40) |
| Questões / edição | 80 (deterministicamente) → 640 total |
| Subtemas distintos cobrados | 158 |
| Subtemas em ≥4 edições (set de análise) | **75** |
| **Distribuição das células (subtema × edição)** | **469 células = 1 questão · 75 = 2 · 7 = 3 · máx = 3** |

**O ponto central (ANTI-CHUTE):** a célula típica vale **1 questão**. A "série temporal" de um subtema
é algo como `0 1 1 0 0 1 2 0` — quase só 0s e 1s. O ruído de Poisson sobre uma contagem ~1 tem
desvio-padrão ~1, ou seja **ruído ≈ sinal**. Slope, "subiu/caiu" e CV calculados sobre isso são, a
priori, dominados por ruído. Por isso a detecção foi feita **contra um benchmark de ruído** (teste de
permutação), não no olho.

---

## 3. Método

Para cada um dos 75 subtemas (densificando zeros nas 8 edições):
- **(a) slope** OLS de `n_questoes` vs ordem da edição (x = 0..7);
- **(b) Δ = média(últimas 3 edições: 44,45,46) − média(primeiras 3: 38,39,41)`;
- **(c) CV** = desvio/média da série.
- **Classificação:** RISING se Δ ≥ +0.5 · FALLING se Δ ≤ −0.5 · STABLE caso contrário.

**Teste da hipótese de rotação (o que dá honestidade estatística):** teste de **permutação**,
5000 reamostragens, mantendo **as duas margens fixas** (80 questões/edição **e** o total de cada
subtema) — embaralha-se só o *rótulo de edição* de cada questão. Se a FGV rotaciona, os dados reais
devem mostrar **MAIS** movimento (mais risers/fallers, mais "energia" de slope) do que o embaralhamento
aleatório. Dois nulos:
- **Global:** embaralha edição entre todas as 640 questões → testa qualquer associação subtema↔edição.
- **Estratificado por matéria:** embaralha edição *dentro de cada matéria* → preserva a cota fixa da
  FGV por disciplina e isola **rotação real** de **artefato composicional** (cota fixa: se um subtema
  sobe, outro mecanicamente desce).

Estatística agregada sobre os 75: nº RISING, nº FALLING, nº em movimento (`nMove`), soma dos slopes²
(`SS`, "energia temporal" total) e `maxAbs` (maior |slope|). p-valor unicaudal = fração de permutações
com valor ≥ observado.

---

## 4. Resultado — o sinal observado é MENOR que o do acaso

| estatística | **observado** | nulo GLOBAL (média · p05–p95) | p | nulo por MATÉRIA (média · p05–p95) | p |
|---|---|---|---|---|---|
| nº em movimento (de 75) | **27** | 36.0 · (29–43) | 0.99 | 33.3 · (26–40) | 0.94 |
| nº RISING | **13** | 18.0 · (13–23) | 0.98 | 16.6 · (12–21) | 0.92 |
| nº FALLING | **14** | 18.0 · (13–23) | 0.95 | 16.7 · (12–21) | 0.88 |
| energia de slope (SS) | **0.716** | 1.356 · (1.02–1.72) | 1.00 | 1.167 · (0.87–1.50) | 1.00 |
| maior \|slope\| | **0.190** | 0.364 · (0.27–0.48) | 1.00 | 0.333 · (0.26–0.44) | 1.00 |

**Leitura:** em TODAS as medidas e nos DOIS nulos, o dado real fica **no piso ou abaixo do percentil 5**
da distribuição de ruído. Traduzindo:
- Parecem ter "se mexido" 27 subtemas — mas o puro acaso mexeria **~36**. Há **menos** movimento que o acaso.
- O subtema **mais extremo** da base tem |slope| = **0.19**; o ruído puro, só por sortear, produz um
  máximo médio de **0.36** (p95 = 0.48). **Nenhum** subtema real chega perto do que o ruído gera sozinho.

Isto é a assinatura de um sistema com **blueprint fixo** (a FGV espalha cada subtema de forma
relativamente uniforme), **não** de um que concentra um subtema num pico de 3 anos e depois o abandona.

### Matéria (nível de maior poder estatístico — contagens grandes)
Aqui a evidência é gritante. Índice de dispersão (var/média; Poisson = 1.0), medido **direto no SQL**:

| matéria | série por edição | média | var/média |
|---|---|---|---|
| Ética/Estatuto OAB | `8,8,8,8,8,8,8,9` | 8.13 | **0.015** |
| Processual Civil | `6,6,6,6,7,6,6,6` | 6.13 | **0.020** |
| Tributário | `5,5,5,5,5,5,5,5` | 5.00 | **0.000** |
| Civil | `7,7,8,6,6,7,7,7` | 6.88 | 0.060 |
| Constitucional | `7,6,7,6,6,7,6,5` | 6.25 | 0.080 |
| Ambiental / Consumidor / Previdenciário / Eleitoral | `2,2,2,2,2,2,2,2` | 2.00 | **0.000** |

**Todas as 20 matérias são fortemente sub-dispersas** (var/média ≪ 1) e têm CV muito abaixo do piso de
ruído de Poisson (1/√média). A cota por disciplina é **quase determinística** — não há rotação *entre*
disciplinas. As únicas com algum tremor (Internacional `1,4,1,3,1,1,2,2`; ECA `2,0,1,2,2,2,3,2`) são as
de menor cota (~2/edição), onde ±1 parece grande mas continua **abaixo** do ruído de Poisson.

---

## 5. RISING / FALLING — os números reais (e por que são ruído)

São listados porque foram pedidos, **com o aviso de que estão dentro do ruído** (ver §4): mesmo o mais
extremo (|slope| 0.19) fica abaixo do máximo médio do acaso (0.36).

**Maiores "quedas" (Δ):**
| subtema | matéria | série (38→46) | Δ | slope |
|---|---|---|---|---|
| Controle de constitucionalidade | Constitucional | `1,3,3,0,1,1,1,1` | −1.33 | −0.179 |
| Registro de empresa / nome empresarial | Empresarial | `2,0,2,0,1,1,0,0` | −1.00 | −0.190 |
| Direito das Obrigações | Civil | `1,2,1,1,1,0,1,0` | −1.00 | −0.179 |
| Inscrição na OAB | Ética/OAB | `2,1,1,0,0,0,0,1` | −1.00 | −0.179 |

**Maiores "altas" (Δ):**
| subtema | matéria | série (38→46) | Δ | slope |
|---|---|---|---|---|
| Cumprimento de sentença | Processual Civil | `0,2,0,2,1,1,2,2` | +1.00 | +0.190 |
| Lei de Responsabilidade Fiscal | Financeiro | `0,0,0,2,1,1,1,1` | +1.00 | +0.167 |
| Teoria do crime | Penal | `2,1,2,1,1,2,3,2` | +0.67 | +0.119 |
| Infrações e sanções disciplinares | Ética/OAB | `0,0,1,0,1,1,1,1` | +0.67 | +0.155 |

Note como cada "queda" é um pico de 1–2 questões cedo (ex.: Controle de const. teve 3 em ed39 e ed41)
voltando ao patamar de ~1 — exatamente o que um sorteio com total fixo gera.

**Pares de "rotação" dentro de matéria** (um sobe enquanto outro cai): existem 7 matérias com ≥1 riser
e ≥1 faller. Mas isso é **artefato composicional** (cota fixa) e o nulo estratificado — que já controla
por isso — mostra que o movimento real é **menor** que o esperado. Não é rotação; é o ruído rearranjado
dentro de um orçamento travado.

---

## 6. Por que NÃO dá para confirmar um ciclo de 3 anos (mesmo se existisse)

Dois limites se somam:
1. **Esparsidade:** ~1 questão/célula. Só uma rotação enorme (subtema indo de ~0 para ~4–5/edição)
   seria detectável. Nada disso existe na base.
2. **Janela curta:** ed38→ed46 cobre ~2.5 anos. Para *observar* um ciclo de ~3 anos é preciso ≥2 ciclos
   completos ≈ 6 anos ≈ ~18–20 edições. Em 2.5 anos não cabe **nem um** ciclo — veria-se, no máximo, uma
   perna de subida OU de descida, indistinguível de ruído ou de evento pontual.

Trazer ed37 e ed40 (faltantes) **não muda o veredito**: +2 pontos numa série de 8→10 não resgata
células de contagem ~1.

---

## 7. Recomendação ao planner do cronograma

**Manter incidência cumulativa; NÃO introduzir peso de tendência/rotação.**

1. **`pesoIncidencia` = `v_incidencia_subtema.n_questoes`** (cumulativo na janela). É o sinal estável e correto.
2. **Recência já está resolvida pela janela** (só ed37–46 ingeridas). Dentro de uma janela de ~2.5 anos
   com cotas fixas, não há gradiente de "envelhecimento" intra-janela para modelar — nem decay por edição
   é necessário.
3. **`v_tendencia_subtema` serve para EXIBIÇÃO/monitoramento**, não para peso: mostrar a série a Marcos/Kamile
   torna a estabilidade *visível* (anti-chute para o próprio produto) e permite revisar este veredito quando
   houver mais edições. **Não** deve alimentar priorização.

### Se algum dia quiserem mesmo um viés de recência (com salvaguardas)
Nunca extrapolar tendência por subtema. No máximo, um leve tilt **na janela**, limitado:

```
peso_final(subtema) = pesoFraqueza(usuária)               -- diag_por_no, eixo=subtema (o que importa)
                    × pesoIncidencia(subtema)              -- v_incidencia_subtema.n_questoes
                    × (1 + α · recencia_norm(subtema))     -- tilt OPCIONAL, só se exigido

onde:
  recencia_norm = clamp( (last3 − first3) / max(1, total_subtema) , −1, +1 )   -- de v_tendencia_subtema
  α ≤ 0.15            -- teto duro: o tilt nunca move o peso mais que ±15%
```

**Guardrails inegociáveis (anti-fit-de-ruído):**
- **α pequeno e com teto** (≤0.15). Tendência aqui é ruído; o teto impede que ele domine.
- **Reaproveitar o gate de amostra** (`diag_gate_minimo()` = 8): só aplicar o tilt a subtemas com total
  ≥ gate na janela. Abaixo disso, `recencia_norm = 0`.
- **Exigir que o efeito BATA o nulo de permutação** antes de confiar em qualquer "alta/queda" por subtema.
  Hoje **nenhum** bate — então, hoje, **α deve ser 0**.
- Reavaliar só quando a janela tiver ≥12 edições com células ≥2 em média.

---

## 8. Caveats / o que mudaria o veredito

- **Poder baixo:** ausência de sinal ≠ prova de ausência. Posso afirmar que **não há sinal detectável** e
  que a base é **estruturalmente curta/esparsa demais** para um ciclo de 3 anos — não que rotação sutil
  seja impossível.
- A "super-estabilidade" (observado < nulo) é em parte **mecânica** (cota fixa amortece variância); não é
  prova de que a FGV anti-agrupa de propósito. A leitura honesta é "sem rotação; incidência estável,
  consistente com blueprint fixo".
- Veredito vale para o corpus atual (ed38–46). Reabrir quando houver ~6+ anos de edições com contagens maiores.

---

### Reprodutibilidade
- View: `supabase/migrations/20260628201154_tendencia_subtema.sql`
- Motor de análise (permutação, 5000×, RNG seeded): `scratchpad/analyze.js` sobre export question-level
  de `questoes ⋈ exames`. Margens fixas; dois nulos (global + estratificado por matéria).
