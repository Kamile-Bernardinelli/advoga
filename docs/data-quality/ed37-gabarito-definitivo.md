# ed37 — reconciliação com o gabarito DEFINITIVO (2026-06-29)

A edição 37 foi sourceada do gabarito **PRELIMINAR** (único disponível no momento da ingestão; as demais edições vieram de gabarito definitivo/correto). O Motor de Validade Legal (workflow `validade-legal-reform-sensitive`) pegou de brinde possíveis divergências, e fizemos a reconciliação autoritativa abaixo.

## Fonte autoritativa
- **Comunicado da Coordenação Nacional do EOU, 16/03/2023** — `https://s.oab.org.br/arquivos/2023/03/7d45b91a-9fc1-4a20-8140-1747bcc61d33.pdf`
- Anúncio: `http://www.oab.org.br/noticia/60815/confira-o-gabarito-definitivo-e-o-resultado-preliminar-da-1-fase-do-37-eou`

## Única mudança preliminar → definitivo
- **Anulação das questões 7 e 69** (caderno Tipo 1 e correspondentes nos tipos 2/3/4), item 5.9 do edital.
- Aplicado: `validade_status='anulada'`, `gabarito=NULL`, `validade_motivo` registrado → excluídas de `questoes_prova` (não entram na prática). Refletido no cloud e em `data/structured/oab37_tipo1.json`.

## Falsos positivos (importante)
Os agentes `@legal-chief` (workflow de validade) flagaram **q28, q29, q34, q77** como gabarito errado, com base em análise jurídica (citação de artigos). **O gabarito definitivo oficial NÃO alterou nenhuma delas** — apenas anulou 7 e 69. Portanto a resposta **oficial da FGV prevalece** e essas 4 foram **mantidas** sem alteração.

**Lição (anti-chute):** análise jurídica de LLM ≠ gabarito oficial da banca. Questões da OAB podem ter resposta juridicamente discutível, mas a resposta oficial é a que vale. Não alterar gabarito de produção sem fonte autoritativa foi a decisão correta.

## Cobertura
- Demais edições (38–46): sourceadas de gabarito definitivo/correto (os agentes confirmaram explicitamente os gabaritos da ed40 em q40/50/60/70/71/77).
- Total cloud pós-fix: 800 questões, 11 anuladas (ed37=2, ed38=3, ed39=3, ed40=1, ed43=2), 789 em `questoes_prova`.

## Atualização 2026-06-29 (2ª rodada) — gabaritos VERIFICADOS + conteúdo corrompido descoberto

### Gabaritos: 100% corretos (verificado vs grade DEFINITIVA oficial)
Baixei o **gabarito definitivo completo** (`s.oab.org.br`/qconcursos, Tipo 1) e comparei as 80 da ed37 programaticamente: **batem 100%** (a definitiva = preliminar exceto q7/q69 anuladas, já aplicadas). Confirmado: nenhuma mudança de resposta no recurso além das 2 anulações.

**Padrão de FALSO POSITIVO dos agentes LLM (3 rodadas):** validade (q28/29/34/77), piloto de explicações (q42/q78) — todos flagaram "gabarito errado" e **todos estavam errados**. O LLM jurista confunde a opinião dele com a resposta oficial da banca. **Regra:** nunca alterar gabarito de produção por análise de LLM; só por grade oficial. Anti-chute venceu 3×.

### Conteúdo corrompido: 8 questões da recuperação por visão
O dedup (md5 do enunciado) revelou 8 pares idênticos na ed37: **26≡27, 33≡35, 38≡42, 47≡56, 50≡60, 55≡68, 59≡74, 73≡77**. As "primeiras" (26,33,38,47,50,55,59,73) são todas da minha recuperação por visão das 14 OCR-missed → o workflow retornou o conteúdo da questão VIZINHA (gabarito certo, conteúdo errado). Outras edições (38–46): sem duplicatas.
- **Ação imediata:** as 8 marcadas `validade_status='desatualizada'` (fora de `questoes_prova` → 781 praticáveis, sem duplicatas) com motivo de corrupção. Gabaritos delas continuam corretos.
- **Pendente (re-recuperação):** re-extrair o conteúdo REAL das 8 do PDF da prova com verificação de número (a tentativa via agente bateu rate-limit do servidor). Ao corrigir o conteúdo, restaurar para `vigente`. JSON `data/structured/oab37_tipo1.json` ainda tem o conteúdo corrompido nessas 8.
