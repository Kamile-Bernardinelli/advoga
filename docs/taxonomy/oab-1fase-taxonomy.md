# Taxonomia OAB 1ª Fase — Seed Canônico (Advoga)

> **Autor:** legal-chief (consultor de domínio jurídico BR) · **Modelo:** Opus
> **Data:** 2026-06-21 · **Corte legislativo:** **25/05/2026** (edital 47º EOU)
> **Fonte factual:** `kamile-oab/02-RESEARCH-exam-and-sources.md` (R-04 distribuição, R-05 incidência) + `01-BRIEF.md` §8.1 (eixos de conteúdo + dimensões abertas).
> **Destino:** seed das tabelas `materias`, `subtemas`, `micro_topicos`, `dimensoes`, `dimensao_valores` (schema §8.2 do BRIEF).
> **Banca:** FGV · **Prova:** 47º EOU 1ª fase, 80 questões, 20 disciplinas, aprovação 40 acertos (50%).

---

## 0. Como ler este documento (contrato com o schema)

A taxonomia mapeia 1:1 nas tabelas do §8.2:

```
materias(id, nome, grupo[A|B|C], questoes_por_prova)   ← Seção 1
subtemas(id, materia_id, nome)                          ← Seção 2
micro_topicos(id, subtema_id, nome)                     ← Seção 3 (só alta incidência = "micro semente")
dimensoes(id, chave, nome, tipo, descricao)            ← Seção 4
dimensao_valores(id, dimensao_id, valor)               ← Seção 4 (categóricas)
```

**Convenções:**
- `slug` = chave estável em snake_case minúsculo, sem acento, para FK/seed determinístico (não muda entre edições). O `nome` é a label de exibição (com acento/maiúscula).
- ⚖️ **REFORM-WATCH** = subtema/tópico sensível a alteração legislativa recente; o **Motor de Validade (Drop 3)** deve vigiá-lo ao classificar questões de edições antigas (a resposta "correta" pode ter mudado).
- 🌱 **micro semente** = micro-tópicos prioritários para o Drop 2 (subtemas de alta incidência).
- **Tier de incidência** herda de R-05: Grupo A (alta) · B (intermediária) · C (menor).

---

## 1. As 20 Disciplinas (tabela `materias`)

### 1.1 Validação jurídica vs. research

A distribuição do R-04 soma **80 ✓** e é **juridicamente consistente** com o padrão FGV pós-reestruturação (incorporação de Previdenciário, Financeiro e Eleitoral). **Confirmo os pesos** solicitados: Ética 8, Civil 6, Proc. Civil 6, Constitucional 6, Penal 6, Proc. Penal 6, Administrativo 5, Trabalho 5, Proc. Trabalho 5, Tributário 5, Empresarial 4, e as 9 disciplinas do Grupo C com 2 cada.

**Correção de nomenclatura (1 item):** a disciplina nº 1 não é apenas "Ética Profissional e Estatuto da OAB". A denominação **juridicamente correta e usada pela FGV** é **"Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina"**. O escopo abrange quatro diplomas — Lei 8.906/94 (Estatuto), Regulamento Geral, Código de Ética e Disciplina (CED, Resolução CFOAB 02/2015) e os **Provimentos do CFOAB** (notadamente o 205/2021 sobre publicidade). Mantenho `etica_estatuto` como slug e registro o nome comum como alias para busca.

**Nenhuma outra correção de peso ou de lista** — as 20 disciplinas e os quantitativos estão corretos.

### 1.2 Seed `materias`

| # | slug | nome | grupo | questoes_por_prova | tier | nome_comum / alias |
|---|------|------|:-----:|:------------------:|:----:|--------------------|
| 1 | `etica_estatuto` | Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina | A | 8 | alta | Ética Profissional / Ética e Estatuto |
| 2 | `direito_constitucional` | Direito Constitucional | A | 6 | alta | Constitucional |
| 3 | `direito_civil` | Direito Civil | A | 6 | alta | Civil |
| 4 | `processo_civil` | Direito Processual Civil | A | 6 | alta | Processo Civil / CPC |
| 5 | `direito_penal` | Direito Penal | A | 6 | alta | Penal |
| 6 | `processo_penal` | Direito Processual Penal | A | 6 | alta | Processo Penal / CPP |
| 7 | `direito_administrativo` | Direito Administrativo | B | 5 | media | Administrativo |
| 8 | `direito_tributario` | Direito Tributário | B | 5 | media | Tributário |
| 9 | `direito_trabalho` | Direito do Trabalho | B | 5 | media | Trabalho / CLT |
| 10 | `processo_trabalho` | Direito Processual do Trabalho | B | 5 | media | Processo do Trabalho |
| 11 | `direito_empresarial` | Direito Empresarial | B | 4 | media | Empresarial / Comercial |
| 12 | `direitos_humanos` | Direitos Humanos | C | 2 | menor | — |
| 13 | `direito_internacional` | Direito Internacional | C | 2 | menor | Internacional (público e privado) |
| 14 | `direito_ambiental` | Direito Ambiental | C | 2 | menor | Ambiental |
| 15 | `direito_consumidor` | Direito do Consumidor | C | 2 | menor | CDC |
| 16 | `direito_eleitoral` | Direito Eleitoral | C | 2 | menor | Eleitoral |
| 17 | `direito_financeiro` | Direito Financeiro | C | 2 | menor | Financeiro |
| 18 | `direito_previdenciario` | Direito Previdenciário | C | 2 | menor | Previdenciário |
| 19 | `eca` | Estatuto da Criança e do Adolescente (ECA) | C | 2 | menor | ECA |
| 20 | `filosofia_direito` | Filosofia do Direito | C | 2 | menor | Filosofia / Sociologia jurídica |

**Verificação de soma:** 8+6+6+6+6+6 (A=38) + 5+5+5+5+4 (B=24) + 2×9 (C=18) = **80 ✓**

> **Nota sobre ordem na prova:** a coluna `#` acima é a ordenação por tier/grupo (útil para UI). A *ordem física na prova* (R-04: Ética→Filosofia→Constitucional→...) varia por Tipo (1/2/3/4) e **não deve** ser usada como chave — é metadado de `exames`/`questoes`, não de `materias`.

---

## 2. Subtemas por Disciplina (tabela `subtemas`)

> Taxonomia **canônica e abrangente** — cobre o conteúdo programático do edital, não apenas os "mais cobrados", para classificar **qualquer** questão de prova real. Subtemas de alta incidência (R-05) marcados com ★. Reform-watch marcado com ⚖️.

### 2.1 `etica_estatuto` — Ética / Estatuto (8q, A) ★ maior ROI da prova
Diplomas: Lei 8.906/94 · Regulamento Geral · CED (Res. CFOAB 02/2015) · Provimentos CFOAB.

| slug | nome | obs |
|------|------|-----|
| `etica_advocacia_atividade` | Advocacia: conceito, atividade privativa e exercício | inclui advocacia pública e *pro bono* |
| `etica_inscricao` | Inscrição na OAB (principal e suplementar) e requisitos | ★ |
| `etica_incompatibilidades_impedimentos` | Incompatibilidades e impedimentos | ★ distinção é pegadinha clássica |
| `etica_direitos_prerrogativas` | Direitos e prerrogativas do advogado (Arts. 6º e 7º) | ★ inviolabilidade, comunicação com preso, acesso a autos |
| `etica_honorarios` | Honorários advocatícios (contratuais, sucumbenciais, arbitrados) | ★ natureza alimentar; contratuais x sucumbência |
| `etica_sociedade_advogados` | Sociedade de advogados e sociedade unipessoal | inclui advogado associado |
| `etica_deveres_sigilo` | Deveres do advogado e sigilo profissional | ★ |
| `etica_publicidade` | Publicidade e marketing jurídico | ★ ⚖️ Provimento 205/2021 (substituiu 94/2000) |
| `etica_infracoes_sancoes` | Infrações e sanções disciplinares (censura, suspensão, exclusão, multa) | ★ Arts. 34-43 |
| `etica_processo_disciplinar` | Processo disciplinar e prescrição | competência, prescrição quinquenal |
| `etica_oab_institucional` | OAB institucional (Conselhos, órgãos, eleições, TED) | estrutura federativa |
| `etica_relacoes` | Relações com cliente, colegas, magistratura e parte contrária | CED |
| `etica_advocacia_publica_dativa` | Advocacia pública, defensoria dativa e honorários do dativo | interdisciplinar |

### 2.2 `direito_constitucional` — Constitucional (6q, A) ★
| slug | nome | obs |
|------|------|-----|
| `const_teoria_constituicao` | Teoria da Constituição, poder constituinte e classificação | |
| `const_principios_fundamentais` | Princípios fundamentais (Arts. 1º-4º) | |
| `const_direitos_garantias` | Direitos e garantias fundamentais (Art. 5º) | ★ |
| `const_remedios_constitucionais` | Remédios constitucionais (HC, MS, MI, HD, ação popular) | ★ |
| `const_direitos_sociais` | Direitos sociais, nacionalidade e direitos políticos | |
| `const_organizacao_estado` | Organização do Estado e repartição de competências | ★ federalismo |
| `const_administracao_publica_const` | Administração pública na CF (Art. 37 e ss.) | interface com Adm. |
| `const_poder_legislativo` | Poder Legislativo e processo legislativo | |
| `const_poder_executivo` | Poder Executivo | |
| `const_poder_judiciario` | Poder Judiciário e funções essenciais à Justiça | |
| `const_controle_constitucionalidade` | Controle de constitucionalidade (difuso e concentrado) | ★ ADI/ADC/ADPF/ADO |
| `const_ordem_social_economica` | Ordem social e ordem econômica e financeira | |
| `const_defesa_estado` | Defesa do Estado e das instituições democráticas | baixa incidência |

### 2.3 `direito_civil` — Civil (6q, A) ★ maior volume absoluto
⚖️ **REFORM-WATCH GLOBAL:** o **PL 4/2025 (Reforma do Código Civil)** ainda é *projeto* — relatório final previsto 11/03/2026, votação só prevista até julho/2026. **Como está APÓS o corte de 25/05/2026 sem virar lei, o CC/2002 (Lei 10.406/2002) permanece integralmente vigente.** Nenhum dispositivo do PL 4/2025 é cobrável no 47º EOU. O Motor de Validade deve travar essa âncora e reavaliar só se/quando promulgado.

| slug | nome | obs |
|------|------|-----|
| `civ_lindb` | LINDB (Lei de Introdução às Normas do Direito Brasileiro) | aplicação da norma |
| `civ_parte_geral` | Parte Geral: pessoas, bens, fatos e negócios jurídicos | ★ inclui prescrição e decadência |
| `civ_obrigacoes` | Direito das Obrigações | ★ |
| `civ_responsabilidade_civil` | Responsabilidade civil | ★ ⚖️ tema de digital/IA no PL 4/2025 (não vigente) |
| `civ_contratos_geral` | Teoria geral dos contratos | |
| `civ_contratos_especie` | Contratos em espécie | ★ compra e venda, locação, fiança etc. |
| `civ_atos_unilaterais` | Atos unilaterais e responsabilidade pré/pós-contratual | |
| `civ_direito_coisas` | Direito das Coisas (reais) | ★ posse, propriedade, direitos reais |
| `civ_familia` | Direito de Família | ⚖️ alvo recorrente de jurisprudência (STF/STJ) |
| `civ_sucessoes` | Direito das Sucessões | ★ |
| `civ_registros_publicos` | Registros públicos e prova | interdisciplinar |

### 2.4 `processo_civil` — Processo Civil (6q, A) ★ 2º maior volume
⚖️ **REFORM-WATCH GLOBAL:** **CPC/2015 (Lei 13.105/2015)** revogou o CPC/73. Questões pré-2016 podem usar institutos/prazos do CPC/73 (ex.: contagem em dias corridos → hoje **dias úteis**, Art. 219). Alto risco de "questão desatualizada".

| slug | nome | obs |
|------|------|-----|
| `pc_normas_fundamentais` | Normas fundamentais e aplicação do CPC | |
| `pc_jurisdicao_acao` | Jurisdição, ação e elementos | |
| `pc_competencia` | Competência | ★ |
| `pc_partes_litisconsorcio` | Partes, litisconsórcio, intervenção de terceiros | |
| `pc_atos_prazos_nulidades` | Atos processuais, prazos e nulidades | ⚖️ dias úteis (CPC/2015) |
| `pc_tutela_provisoria` | Tutela provisória (urgência e evidência) | ★ |
| `pc_processo_conhecimento` | Processo de conhecimento e procedimento comum | |
| `pc_provas` | Teoria geral das provas | |
| `pc_sentenca_coisa_julgada` | Sentença, coisa julgada e remessa necessária | |
| `pc_recursos` | Recursos | ★ maior incidência interna |
| `pc_cumprimento_sentenca` | Cumprimento de sentença | |
| `pc_execucao` | Processo de execução (título extrajudicial) | ★ |
| `pc_procedimentos_especiais` | Procedimentos especiais | |
| `pc_juizados_especiais_civeis` | Juizados Especiais Cíveis (Lei 9.099/95) | interdisciplinar |
| `pc_precedentes` | Precedentes, IRDR e ordem dos processos nos tribunais | ⚖️ novidade CPC/2015 |

### 2.5 `direito_penal` — Penal (6q, A) ★
⚖️ **REFORM-WATCH GLOBAL:** **Lei 13.964/2019 (Pacote Anticrime)** alterou penas, prescrição, legítima defesa, livramento condicional e confisco alargado. Questões pré-2020 podem ter respostas defasadas.

| slug | nome | obs |
|------|------|-----|
| `pen_aplicacao_lei_penal` | Aplicação da lei penal (tempo, espaço, anterioridade) | |
| `pen_teoria_crime` | Teoria do crime (fato típico, ilicitude, culpabilidade) | ★ |
| `pen_excludentes` | Excludentes de ilicitude e de culpabilidade | ⚖️ legítima defesa (Anticrime) |
| `pen_concurso_pessoas` | Concurso de pessoas | |
| `pen_concurso_crimes` | Concurso de crimes | exige-cálculo |
| `pen_penas` | Penas: espécies, aplicação (dosimetria) e regimes | ★ exige-cálculo |
| `pen_medidas_seguranca` | Medidas de segurança | |
| `pen_extincao_punibilidade` | Extinção da punibilidade e prescrição | ★ ⚖️ exige-cálculo |
| `pen_crimes_contra_pessoa` | Crimes contra a pessoa (vida, lesão, honra) | ★ |
| `pen_crimes_contra_patrimonio` | Crimes contra o patrimônio | ★ furto, roubo, estelionato |
| `pen_crimes_contra_adm_publica` | Crimes contra a Administração Pública | ★ |
| `pen_crimes_contra_dignidade_sexual` | Crimes contra a dignidade sexual | |
| `pen_crimes_contra_fe_publica` | Crimes contra a fé pública e a coletividade | |
| `pen_legislacao_especial` | Legislação penal especial (drogas, ECA penal, Maria da Penha, tortura) | ⚖️ interdisciplinar |

### 2.6 `processo_penal` — Processo Penal (6q, A) ★
⚖️ **REFORM-WATCH GLOBAL:** Pacote Anticrime (Lei 13.964/2019) criou o **juiz das garantias** (Arts. 3º-A a 3º-F CPP) — declarado constitucional e obrigatório pelo STF (ADIs 6298/6299/6300/6305, jul. 2023, com interpretação conforme) e acordo de não persecução penal (ANPP, Art. 28-A). Alta dependência de jurisprudência.

| slug | nome | obs |
|------|------|-----|
| `pp_inquerito_policial` | Inquérito policial e investigação criminal | |
| `pp_acao_penal` | Ação penal (pública e privada) e ANPP | ⚖️ ANPP (Art. 28-A, Anticrime) |
| `pp_juiz_garantias` | Juiz das garantias e competência | ⚖️ STF ADI 6298 |
| `pp_jurisdicao_competencia` | Jurisdição e competência criminal | |
| `pp_provas_penais` | Provas no processo penal | ★ cadeia de custódia (Anticrime) |
| `pp_prisao_medidas_cautelares` | Prisão e medidas cautelares (incl. audiência de custódia) | ★ ⚖️ |
| `pp_sujeitos_processuais` | Sujeitos processuais e atos processuais | |
| `pp_procedimentos` | Procedimentos (comum, sumário, sumaríssimo, júri) | ★ tribunal do júri |
| `pp_nulidades` | Nulidades | |
| `pp_recursos_penais` | Recursos | ★ maior incidência interna (R-05) |
| `pp_acoes_autonomas` | Ações autônomas de impugnação (HC, revisão criminal, MS) | |
| `pp_execucao_penal` | Execução penal (LEP) | interdisciplinar |
| `pp_juizados_criminais` | Juizados Especiais Criminais (Lei 9.099/95) | |

### 2.7 `direito_administrativo` — Administrativo (5q, B)
⚖️ **REFORM-WATCH:** **Lei 14.133/2021 (Nova Lei de Licitações)** substituiu a Lei 8.666/93 (revogada definitivamente em 2023). E **Lei 14.230/2021** reformou a improbidade (Lei 8.429/92). Ambas são alto risco de defasagem.

| slug | nome | obs |
|------|------|-----|
| `adm_regime_principios` | Regime jurídico-administrativo e princípios | |
| `adm_organizacao` | Organização administrativa (direta, indireta, terceiro setor) | |
| `adm_poderes` | Poderes administrativos | |
| `adm_atos_administrativos` | Atos administrativos | ★ atributos, vícios, anulação/revogação |
| `adm_licitacoes` | Licitações | ★ ⚖️ Lei 14.133/2021 |
| `adm_contratos_administrativos` | Contratos administrativos | ⚖️ |
| `adm_servicos_publicos` | Serviços públicos e concessões/permissões | |
| `adm_agentes_publicos` | Agentes públicos | ★ regime, provimento, responsabilidade |
| `adm_responsabilidade_civil_estado` | Responsabilidade civil do Estado | ★ Art. 37, §6º |
| `adm_bens_publicos` | Bens públicos e intervenção na propriedade | desapropriação |
| `adm_improbidade` | Improbidade administrativa | ⚖️ Lei 14.230/2021 |
| `adm_controle` | Controle da Administração e processo administrativo | inclui Lei 9.784/99 |
| `adm_poder_policia` | Poder de polícia e ordenação administrativa | |

### 2.8 `direito_tributario` — Tributário (5q, B)
⚖️ **REFORM-WATCH CRÍTICO:** **EC 132/2023 + LC 214/2025 (Reforma Tributária)** criaram **IBS, CBS e Imposto Seletivo (IS)**. **2026 é ano de TESTE** (alíquotas simbólicas 0,9% CBS / 0,1% IBS, sem cobrança efetiva); cobrança real só a partir de 2027, transição até 2033. Para o 47º EOU: o **texto constitucional reformado e a LC 214/2025 são vigentes (cobráveis como letra de lei)**, mas os tributos clássicos (ICMS, ISS, PIS/Cofins) **continuam em vigor na transição**. O Motor de Validade deve distinguir "vigente no corte" de "em transição" e vigiar questões que tratem do sistema antigo como se fosse o único.

| slug | nome | obs |
|------|------|-----|
| `trib_sistema_constitucional` | Sistema tributário constitucional e competência | ⚖️ EC 132/2023 |
| `trib_limitacoes_poder_tributar` | Limitações ao poder de tributar (princípios e imunidades) | ★ |
| `trib_tributos_especies` | Tributos e suas espécies (impostos, taxas, contribuições) | ⚖️ IBS/CBS/IS |
| `trib_obrigacao_tributaria` | Obrigação tributária (fato gerador, sujeição) | ★ |
| `trib_responsabilidade_tributaria` | Responsabilidade tributária | ★ |
| `trib_credito_tributario` | Crédito tributário, lançamento, suspensão/extinção/exclusão | ★ |
| `trib_administracao_tributaria` | Administração tributária e garantias/privilégios do crédito | |
| `trib_impostos_especie` | Impostos em espécie (federais, estaduais, municipais) | ★ maior incidência interna |
| `trib_processo_tributario` | Processo tributário (administrativo e judicial) | execução fiscal |
| `trib_simples_nacional` | Simples Nacional e regimes especiais | interdisciplinar |

### 2.9 `direito_trabalho` — Trabalho (5q, B)
⚖️ **REFORM-WATCH:** **Lei 13.467/2017 (Reforma Trabalhista)** alterou profundamente a CLT (jornada, terceirização, contrato intermitente, fim da contribuição sindical obrigatória, prevalência do negociado). Questões pré-2017 são alto risco. Também a **Lei 13.429/2017 (terceirização)**.

| slug | nome | obs |
|------|------|-----|
| `trab_principios_fontes` | Princípios e fontes do Direito do Trabalho | |
| `trab_relacao_emprego` | Relação de emprego e sujeitos (empregado, empregador) | ★ subordinação, pejotização |
| `trab_contrato_trabalho` | Contrato de trabalho: modalidades e alteração | ⚖️ intermitente (2017) |
| `trab_terceirizacao` | Terceirização e trabalho temporário | ⚖️ Lei 13.429/2017 |
| `trab_remuneracao_salario` | Remuneração e salário | equiparação salarial |
| `trab_jornada` | Jornada de trabalho, intervalos e horas extras | ★ ⚖️ exige-cálculo |
| `trab_ferias_repouso` | Férias e repouso semanal remunerado | exige-cálculo |
| `trab_fgts` | FGTS | ★ |
| `trab_alteracao_suspensao_interrupcao` | Suspensão e interrupção do contrato | |
| `trab_extincao_contrato` | Extinção do contrato e verbas rescisórias | ★ maior incidência interna; exige-cálculo |
| `trab_estabilidade_garantias` | Estabilidade e garantias de emprego | gestante, CIPA, acidente |
| `trab_seguranca_medicina` | Segurança e medicina do trabalho; insalubridade/periculosidade | |
| `trab_direito_coletivo` | Direito coletivo (sindicatos, negociação, greve) | ⚖️ contribuição sindical (2017) |
| `trab_trabalhos_especiais` | Contratos e trabalhos especiais (rural, doméstico, aprendiz) | LC 150/2015 |

### 2.10 `processo_trabalho` — Processo do Trabalho (5q, B)
⚖️ **REFORM-WATCH:** Reforma de 2017 também atingiu o processo (honorários de sucumbência na Justiça do Trabalho, custas, ônus da prova, limitação da gratuidade). Súmulas e IN do TST são determinantes.

| slug | nome | obs |
|------|------|-----|
| `pt_organizacao_justica_trabalho` | Organização e competência da Justiça do Trabalho | ⚖️ EC 45/2004 |
| `pt_principios` | Princípios do processo do trabalho e aplicação subsidiária do CPC | |
| `pt_partes_representacao` | Partes, jus postulandi e representação | |
| `pt_dissidios` | Dissídio individual e dissídio coletivo | |
| `pt_procedimentos` | Procedimentos (ordinário, sumaríssimo, sumário) | |
| `pt_audiencia` | Audiência, conciliação e revelia | |
| `pt_provas_trab` | Provas no processo do trabalho e ônus da prova | ⚖️ Art. 818 (2017) |
| `pt_sentenca_custas` | Sentença, custas e honorários | ⚖️ sucumbência (2017) |
| `pt_recursos_trab` | Recursos trabalhistas | ★ maior incidência interna |
| `pt_execucao_trab` | Execução trabalhista | ★ |
| `pt_acoes_especiais_trab` | Ações especiais (MS, ação rescisória, AR, inquérito) | |
| `pt_nulidades_prescricao` | Nulidades e prescrição trabalhista | |

### 2.11 `direito_empresarial` — Empresarial (4q, B)
⚖️ **REFORM-WATCH:** **Lei 14.112/2020** reformou a Lei 11.101/2005 (recuperação e falência — vigente desde 23/01/2021). **Lei 14.195/2021 (Lei do Ambiente de Negócios)** e a **Lei 14.451/2022** alteraram regras de sociedades (quórum de Ltda).

| slug | nome | obs |
|------|------|-----|
| `emp_teoria_empresa` | Teoria da empresa, empresário e EIRELI/empresário individual | ⚖️ EIRELI extinta (Lei 14.382/2021) |
| `emp_registro_nome_estabelecimento` | Registro de empresa, nome empresarial e estabelecimento | |
| `emp_sociedades_geral` | Direito societário: teoria geral e tipos | ★ maior incidência interna |
| `emp_sociedade_limitada` | Sociedade limitada | ★ ⚖️ Lei 14.451/2022 (quórum) |
| `emp_sociedade_anonima` | Sociedade anônima | Lei 6.404/76 |
| `emp_titulos_credito` | Títulos de crédito | ★ LUG, duplicata, cheque, nota promissória |
| `emp_contratos_empresariais` | Contratos empresariais | franquia, leasing, factoring |
| `emp_falencia_recuperacao` | Falência e recuperação judicial/extrajudicial | ★ ⚖️ Lei 14.112/2020 |
| `emp_propriedade_industrial` | Propriedade industrial (Lei 9.279/96) | marca, patente |
| `emp_direito_concorrencial` | Direito concorrencial e empresarial digital | baixa incidência |

### 2.12 `direitos_humanos` — Direitos Humanos (2q, C)
| slug | nome |
|------|------|
| `dh_teoria_geral` | Teoria geral, dimensões e características dos DH |
| `dh_sistema_global` | Sistema global (ONU): DUDH e pactos |
| `dh_sistema_interamericano` | Sistema interamericano (Pacto de San José, Corte IDH) |
| `dh_incorporacao_interna` | Incorporação ao direito interno e status dos tratados (EC 45/2004) |
| `dh_grupos_vulneraveis` | Proteção de grupos vulneráveis |

### 2.13 `direito_internacional` — Internacional (2q, C)
| slug | nome |
|------|------|
| `int_fontes_tratados` | Fontes e tratados internacionais (Convenção de Viena) |
| `int_sujeitos` | Sujeitos de direito internacional e organizações |
| `int_publico_geral` | Direito internacional público (nacionalidade, asilo, extradição) |
| `int_privado_lindb` | Direito internacional privado (LINDB, elementos de conexão) |
| `int_cooperacao_processual` | Cooperação jurídica internacional e homologação de sentença estrangeira |
| `int_comercio_integracao` | Comércio internacional e integração (Mercosul) |

### 2.14 `direito_ambiental` — Ambiental (2q, C)
| slug | nome |
|------|------|
| `amb_principios_pnma` | Princípios e Política Nacional do Meio Ambiente (Lei 6.938/81) |
| `amb_competencias` | Competências ambientais (LC 140/2011) |
| `amb_licenciamento` | Licenciamento ambiental e estudo de impacto |
| `amb_responsabilidade_ambiental` | Responsabilidade ambiental (civil, penal, administrativa) |
| `amb_codigo_florestal` | Código Florestal (Lei 12.651/2012), APP e reserva legal |
| `amb_tutela_processual` | Tutela processual (ACP, competência) |

### 2.15 `direito_consumidor` — Consumidor (2q, C)
| slug | nome |
|------|------|
| `cdc_relacao_consumo` | Relação de consumo: consumidor, fornecedor, produto/serviço |
| `cdc_direitos_basicos` | Direitos básicos do consumidor |
| `cdc_responsabilidade` | Responsabilidade por vício e por fato do produto/serviço |
| `cdc_praticas_comerciais` | Práticas comerciais, oferta e publicidade |
| `cdc_clausulas_abusivas` | Cláusulas abusivas e proteção contratual |
| `cdc_superendividamento` | Superendividamento (Lei 14.181/2021) — ⚖️ novidade |
| `cdc_defesa_juizo` | Defesa do consumidor em juízo e tutela coletiva |

### 2.16 `direito_eleitoral` — Eleitoral (2q, C)
| slug | nome |
|------|------|
| `ele_direitos_politicos` | Direitos políticos e organização da Justiça Eleitoral |
| `ele_alistamento_filiacao` | Alistamento, filiação partidária e domicílio |
| `ele_inelegibilidades` | Condições de elegibilidade e inelegibilidades (LC 64/90) |
| `ele_registro_candidatura` | Registro de candidatura e convenções |
| `ele_propaganda` | Propaganda eleitoral e condutas vedadas |
| `ele_processo_crimes` | Processo eleitoral, AIJE/AIME e crimes eleitorais |

### 2.17 `direito_financeiro` — Financeiro (2q, C)
| slug | nome |
|------|------|
| `fin_atividade_financeira` | Atividade financeira do Estado e competências |
| `fin_orcamento` | Orçamento público (PPA, LDO, LOA) e princípios orçamentários |
| `fin_receita_despesa` | Receita e despesa pública |
| `fin_credito_divida` | Crédito público e dívida pública |
| `fin_lrf` | Lei de Responsabilidade Fiscal (LC 101/2000) |
| `fin_fiscalizacao` | Fiscalização e controle financeiro (Tribunais de Contas) |

### 2.18 `direito_previdenciario` — Previdenciário (2q, C)
⚖️ **REFORM-WATCH:** **EC 103/2019 (Reforma da Previdência)** alterou regras de aposentadoria, cálculo e pensão. Questões pré-2019 são alto risco.
| slug | nome |
|------|------|
| `prev_seguridade_principios` | Seguridade social: conceito, princípios e custeio |
| `prev_segurados_dependentes` | Segurados e dependentes do RGPS |
| `prev_beneficios` | Benefícios previdenciários (espécies e requisitos) — ⚖️ EC 103/2019 |
| `prev_aposentadorias` | Aposentadorias e regras de transição — ⚖️ exige-cálculo |
| `prev_acidente_trabalho` | Benefícios por incapacidade e acidente de trabalho |
| `prev_assistencia_social` | Assistência social (LOAS/BPC) |

### 2.19 `eca` — ECA (2q, C)
| slug | nome |
|------|------|
| `eca_principios_direitos` | Princípios, proteção integral e direitos fundamentais da criança/adolescente |
| `eca_medidas_protecao` | Medidas de proteção |
| `eca_ato_infracional` | Ato infracional e medidas socioeducativas |
| `eca_familia_convivencia` | Direito à convivência familiar (guarda, tutela, adoção) |
| `eca_conselho_tutelar` | Conselho Tutelar e política de atendimento |
| `eca_acesso_justica_crimes` | Acesso à Justiça e crimes contra crianças/adolescentes |

### 2.20 `filosofia_direito` — Filosofia do Direito (2q, C)
| slug | nome |
|------|------|
| `fil_conceito_direito` | Conceito de Direito e teorias da norma |
| `fil_jusnaturalismo_positivismo` | Jusnaturalismo, positivismo e pós-positivismo |
| `fil_justica` | Teorias da justiça |
| `fil_interpretacao_argumentacao` | Interpretação, argumentação jurídica e hermenêutica |
| `fil_etica_moral_direito` | Ética, moral e direito |
| `fil_sociologia_juridica` | Sociologia jurídica e eficácia social da norma |

---

## 3. Micro-tópicos (tabela `micro_topicos`) — 🌱 SEMENTE Drop 2

> Apenas subtemas de **alta incidência** (★), conforme escopo do BRIEF (semente para o Drop 2). Cada bloco lista `micro_topicos.nome` sob o `subtema` pai (via `subtema_id`). Marcados todos como **micro semente**.

### 3.1 `civ_direito_coisas` (Civil → Direito das Coisas) — exemplo do BRIEF
| slug | nome |
|------|------|
| `coisas_posse_conceito` | Posse: conceito e classificações |
| `coisas_posse_direta` | Posse direta |
| `coisas_posse_indireta` | Posse indireta |
| `coisas_composse` | Composse |
| `coisas_posse_justa_injusta` | Posse justa e injusta (violência, clandestinidade, precariedade) |
| `coisas_posse_boa_ma_fe` | Posse de boa-fé e de má-fé |
| `coisas_efeitos_posse` | Efeitos da posse (interditos possessórios, frutos, benfeitorias) |
| `coisas_propriedade` | Propriedade: conceito, atributos e função social |
| `coisas_aquisicao_propriedade` | Aquisição da propriedade (usucapião, registro, acessão, tradição) |
| `coisas_usucapiao` | Usucapião (modalidades e requisitos) |
| `coisas_direitos_reais_gozo` | Direitos reais sobre coisa alheia: gozo/fruição (servidão, usufruto, superfície) |
| `coisas_direitos_reais_garantia` | Direitos reais de garantia (penhor, hipoteca, anticrese) |
| `coisas_condominio` | Condomínio (geral e edilício) |

### 3.2 `trib_obrigacao_tributaria` (Tributário → Obrigação Tributária) — citado pela Kamile
| slug | nome |
|------|------|
| `obtrib_regra_matriz` | Regra-matriz de incidência tributária |
| `obtrib_criterio_material` | Critério material da hipótese de incidência |
| `obtrib_criterio_espacial` | Critério espacial |
| `obtrib_criterio_temporal` | Critério temporal |
| `obtrib_criterio_pessoal` | Critério pessoal (sujeito ativo e passivo) |
| `obtrib_criterio_quantitativo` | Critério quantitativo (base de cálculo e alíquota) |
| `obtrib_fato_gerador` | Fato gerador (principal e acessória) |
| `obtrib_sujeito_passivo` | Sujeito passivo: contribuinte e responsável |
| `obtrib_obrigacao_principal_acessoria` | Obrigação principal x acessória |
| `obtrib_domicilio_tributario` | Domicílio tributário |

> **Nota jurídica:** a "regra-matriz de incidência" (Paulo de Barros Carvalho) é construção doutrinária, não texto de lei — mas é o esqueleto pelo qual a FGV cobra fato gerador, base de cálculo e sujeição (Arts. 113-118 CTN). Mantida como micro-tópico raiz com os cinco critérios como filhos, exatamente como a Kamile pediu.

### 3.3 `etica_honorarios` (Ética → Honorários) — alta incidência
| slug | nome |
|------|------|
| `hon_contratuais` | Honorários contratuais |
| `hon_sucumbenciais` | Honorários de sucumbência (titularidade do advogado) |
| `hon_arbitrados` | Honorários arbitrados judicialmente |
| `hon_natureza_alimentar` | Natureza alimentar e impenhorabilidade |
| `hon_quota_litis` | Contrato de êxito (quota litis) e limites |
| `hon_dativo` | Honorários do advogado dativo |
| `hon_prescricao_cobranca` | Prescrição e ação de cobrança de honorários |

### 3.4 `pc_recursos` (Processo Civil → Recursos) — alta incidência
| slug | nome |
|------|------|
| `rec_principios` | Princípios recursais (fungibilidade, dialeticidade, non reformatio in pejus) |
| `rec_efeitos` | Efeitos dos recursos (devolutivo, suspensivo, translativo) |
| `rec_apelacao` | Apelação |
| `rec_agravo_instrumento` | Agravo de instrumento |
| `rec_agravo_interno` | Agravo interno |
| `rec_embargos_declaracao` | Embargos de declaração |
| `rec_recurso_especial` | Recurso especial (STJ) |
| `rec_recurso_extraordinario` | Recurso extraordinário e repercussão geral (STF) |
| `rec_recursos_repetitivos` | Recursos repetitivos e juízo de admissibilidade |

### 3.5 `pp_recursos_penais` (Processo Penal → Recursos) — maior incidência interna
| slug | nome |
|------|------|
| `recpp_disposicoes_gerais` | Disposições gerais e pressupostos recursais |
| `recpp_apelacao_criminal` | Apelação criminal |
| `recpp_rese` | Recurso em sentido estrito (RESE) |
| `recpp_embargos` | Embargos de declaração e embargos infringentes |
| `recpp_carta_testemunhavel` | Carta testemunhável |
| `recpp_agravo_execucao` | Agravo em execução |
| `recpp_recursos_excepcionais` | Recursos aos tribunais superiores (REsp, RE) |

### 3.6 `trab_extincao_contrato` (Trabalho → Extinção) — maior incidência interna
| slug | nome |
|------|------|
| `ext_dispensa_sem_justa_causa` | Dispensa sem justa causa |
| `ext_dispensa_justa_causa` | Dispensa por justa causa (Art. 482) |
| `ext_pedido_demissao` | Pedido de demissão |
| `ext_rescisao_indireta` | Rescisão indireta (Art. 483) |
| `ext_distrato` | Distrato / acordo (Art. 484-A, ⚖️ Reforma 2017) |
| `ext_culpa_reciproca` | Culpa recíproca |
| `ext_verbas_rescisorias` | Verbas rescisórias e prazos de pagamento |
| `ext_aviso_previo` | Aviso prévio (trabalhado e indenizado; proporcional) |
| `ext_homologacao_quitacao` | Homologação e quitação anual (⚖️ Reforma 2017) |

### 3.7 `pen_penas` (Penal → Penas/Dosimetria) — alta incidência + exige-cálculo
| slug | nome |
|------|------|
| `penas_especies` | Espécies de pena (privativa, restritiva de direitos, multa) |
| `penas_dosimetria_trifasica` | Dosimetria trifásica (Art. 68) |
| `penas_circunstancias_judiciais` | Circunstâncias judiciais (Art. 59) |
| `penas_agravantes_atenuantes` | Agravantes e atenuantes |
| `penas_causas_aumento_diminuicao` | Causas de aumento e de diminuição |
| `penas_regimes` | Regimes de cumprimento e progressão |
| `penas_substituicao` | Substituição por restritivas de direitos e sursis |
| `penas_livramento_condicional` | Livramento condicional (⚖️ Anticrime) |

> **Total de subtemas com micro semente nesta versão: 7** (1 por dos eixos de maior peso de A/B). Extensível: novos micro-tópicos entram por `INSERT` em `micro_topicos` sem alterar schema.

---

## 4. Dimensões Transversais (tabelas `dimensoes` + `dimensao_valores`) — 🌱 SEMENTE ABERTA

> **Conjunto ABERTO e extensível** (D-06 do BRIEF). Esta é a lista-**semente**. O **Motor de Descoberta de Variáveis (§8.5)** acrescenta dimensões novas via `INSERT` em `dimensoes`/`dimensao_valores` — sem migração de schema. Cada questão recebe N tags (`questao_tags`), com `origem ∈ {humano, llm, minerado}`.

### 4.1 Seed `dimensoes`

| chave | nome | tipo | descricao |
|-------|------|------|-----------|
| `estilo_cognitivo` | Estilo cognitivo da questão | categorica | Como a questão exige raciocínio — eixo-âncora pedido pela Kamile |
| `comando_negativo` | Comando negativo | booleana | Enunciado pede a alternativa INCORRETA / EXCETO / NÃO |
| `exige_calculo` | Exige cálculo | booleana | Resolver exige operação numérica (prazo, dosimetria, verba, alíquota) |
| `enunciado_longo` | Enunciado longo | booleana | Caso/enunciado extenso (custo de leitura/atenção elevado) |
| `dependencia_sumula` | Dependência de súmula/jurisprudência | booleana | Resposta depende de súmula (STF/STJ/TST) ou precedente vinculante |
| `prazo_numerico` | Prazo / valor numérico | booleana | Acerto depende de memorizar prazo, quórum ou número específico |
| `posicao_prova` | Posição na prova (fadiga) | numerica | Nº da questão (1-80) — proxy de fadiga; correlação com erro |
| `interdisciplinar` | Interdisciplinaridade | booleana | Cruza mais de uma disciplina (ex.: Constitucional + Administrativo) |
| `nivel_dificuldade_empirica` | Dificuldade empírica | numerica | % de erro observado (derivado das respostas; alimenta weakness score) |
| `pegadinha_excecao` | Pegadinha de exceção | booleana | Acerto depende de identificar a exceção à regra geral |
| `letra_de_lei_literal` | Cobrança de letra de lei literal | booleana | Resposta é transcrição quase literal de dispositivo |
| `reform_sensitive` | Sensível a reforma | booleana | Toca dispositivo alterado por reforma recente — gatilho p/ Motor de Validade |

### 4.2 Seed `dimensao_valores` (apenas categóricas)

**`estilo_cognitivo`** (única categórica na semente):
| valor | descricao |
|-------|-----------|
| `letra-de-lei` | Cobra texto literal da norma |
| `jurisprudencia-sumula` | Cobra entendimento de tribunal / súmula |
| `caso-concreto` | Aplica norma a um caso narrado (hipótese fática) |
| `pegadinha-exceto` | Comando negativo / exceção / "assinale a INCORRETA" |
| `interdisciplinar` | Cruza duas ou mais disciplinas |
| `doutrina` | Cobra posição doutrinária (ex.: regra-matriz, teorias da pena) |

> **Nota de modelagem:** mantive `comando_negativo`, `pegadinha_excecao` e `interdisciplinar` **também** como dimensões booleanas independentes, além de existirem como *valores* de `estilo_cognitivo`. Razão: o estilo é uma classificação **mutuamente exclusiva** (uma questão é "primariamente" um estilo), enquanto as booleanas são **co-ocorrentes e cruzáveis** no diagnóstico (§8.3 cross-axis: "erra Posse quando é caso-concreto E tem comando negativo"). Isso dá ao Motor de Descoberta máxima liberdade de correlação sem forçar exclusividade. Decisão registrada para @data-engineer.
>
> ⚠️ **Não é colisão de chave:** `interdisciplinar` (e similares) aparece em **duas tabelas distintas** — como `dimensoes.chave` (§4.1) e como `dimensao_valores.valor` de `estilo_cognitivo` (§4.2). São colunas/tabelas diferentes; o UNIQUE de `dimensoes.chave` não conflita com um valor de `dimensao_valores`. Todos os demais slugs do documento são únicos dentro de sua própria tabela.

### 4.3 [AUTO-DECISION] log

- `[AUTO-DECISION]` Incluir `reform_sensitive` como dimensão booleana → **SIM** (reason: cria ponte direta taxonomia↔Motor de Validade do Drop 3; toda questão tagueada como reform_sensitive entra na fila de checagem vs. Planalto na data-corte. Risco baixo, alavancagem alta).
- `[AUTO-DECISION]` `posicao_prova` como `numerica` em vez de categórica (faixas) → **numerica** (reason: preserva granularidade para o Motor de Descoberta correlacionar fadiga sem binning prematuro; binning é decisão de análise, não de schema).
- `[AUTO-DECISION]` Manter dupla modelagem estilo (categórica) + flags (booleanas) → **SIM** (reason: cross-axis do §8.3 precisa de co-ocorrência; exclusividade só no eixo-âncora).
- `[AUTO-DECISION]` Não tagar `validade_status` como dimensão → **correto NÃO fazer** (reason: validade já é coluna de `questoes` no §8.2, não dimensão transversal; evitar duplicação de fonte da verdade).

---

## 5. Mapa de REFORM-WATCH para o Motor de Validade (Drop 3)

> Consolidação das âncoras legislativas que o Motor de Validade deve vigiar ao classificar questões de edições antigas. **Corte: 25/05/2026.** Ordenado por risco de "questão desatualizada".

| Reforma | Diploma | Vigência | Disciplinas afetadas | Risco | Subtemas-chave |
|---------|---------|----------|----------------------|:-----:|----------------|
| CPC/2015 | Lei 13.105/2015 | 18/03/2016 | Processo Civil | **ALTO** | prazos (dias úteis), recursos, tutela provisória, precedentes |
| Pacote Anticrime | Lei 13.964/2019 | 23/01/2020 | Penal, Processo Penal | **ALTO** | juiz das garantias, ANPP, cadeia de custódia, legítima defesa, prescrição |
| Reforma Trabalhista | Lei 13.467/2017 | 11/11/2017 | Trabalho, Proc. Trabalho | **ALTO** | intermitente, terceirização, honorários sucumbência, contribuição sindical |
| Nova Lei de Licitações | Lei 14.133/2021 | 01/04/2021 (8.666 revogada 2023) | Administrativo | **ALTO** | licitações, contratos administrativos |
| Reforma da Improbidade | Lei 14.230/2021 | 26/10/2021 | Administrativo | **ALTO** | improbidade (dolo, prescrição) |
| Reforma da Previdência | EC 103/2019 | 13/11/2019 | Previdenciário | **ALTO** | aposentadorias, cálculo, regras de transição |
| Reforma Tributária | EC 132/2023 + LC 214/2025 | EC 2023; LC 16/01/2025; **teste 2026, cobrança 2027** | Tributário, Constitucional | **MÉDIO-ALTO** | IBS, CBS, IS, competência, transição |
| Reforma Falimentar | Lei 14.112/2020 | 23/01/2021 | Empresarial | **MÉDIO** | recuperação judicial, falência, stay period |
| Fim da EIRELI | Lei 14.382/2021 | 28/06/2021 | Empresarial | **MÉDIO** | empresário individual, transformação em SLU |
| Quórum Ltda | Lei 14.451/2022 | 21/12/2022 | Empresarial | **MÉDIO** | deliberações sociais |
| Publicidade advocacia | Provimento CFOAB 205/2021 | 2021 (revogou 94/2000) | Ética | **MÉDIO** | publicidade, marketing jurídico digital |
| Superendividamento | Lei 14.181/2021 | 02/07/2021 | Consumidor | **MÉDIO** | superendividamento, repactuação |
| LGPD | Lei 13.709/2018 | 18/09/2020 (sanções 01/08/2021) | Civil, Constitucional, Consumidor | **MÉDIO** | proteção de dados (tema emergente FGV) |
| ⚠️ **Código Civil (PL 4/2025)** | PL 4/2025 | **NÃO vigente no corte** (votação prevista jul/2026) | Civil | **VIGIAR** | CC/2002 segue íntegro; reavaliar só se promulgado |

> **Regra de ouro do Motor de Validade:** legislação com entrada em vigor **até 25/05/2026** é cobrável; alteração posterior **não**. Para cada questão tagueada `reform_sensitive=true`, comparar a redação invocada com a vigente na data-corte no Planalto. O caso do **PL 4/2025** é a armadilha inversa: não confundir o *projeto* (não-lei) com direito vigente — qualquer questão/material que trate dispositivos do PL como lei é **inválido** para o 47º EOU.

---

## 6. Resumo Quantitativo (para o seed)

| Tabela | Linhas nesta versão |
|--------|:-------------------:|
| `materias` | **20** |
| `subtemas` | **192** |
| `micro_topicos` (semente Drop 2) | **63** (em 7 subtemas de alta incidência) |
| `dimensoes` | **12** |
| `dimensao_valores` | **6** (todos em `estilo_cognitivo`) |

**Contagem de subtemas por disciplina (soma = 192):** Ética 13 · Constitucional 13 · Civil 11 · Proc. Civil 15 · Penal 14 · Proc. Penal 13 · Administrativo 13 · Tributário 10 · Trabalho 14 · Proc. Trabalho 12 · Empresarial 10 · D. Humanos 5 · Internacional 6 · Ambiental 6 · Consumidor 7 · Eleitoral 6 · Financeiro 6 · Previdenciário 6 · ECA 6 · Filosofia 6.

**Contagem de micro-tópicos por subtema-semente (soma = 63):** Direito das Coisas 13 · Obrigação Tributária 10 · Honorários 7 · Recursos (PC) 9 · Recursos Penais 7 · Extinção do Contrato 9 · Penas/Dosimetria 8.

---

## 7. Correções jurídicas aplicadas vs. research (sumário)

1. **Nomenclatura da disciplina nº 1:** "Ética Profissional e Estatuto da OAB" → **"Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina"** (escopo de 4 diplomas: Lei 8.906/94 + Regulamento Geral + CED Res. 02/2015 + Provimentos CFOAB). Nome comum preservado como alias.
2. **Nomenclatura técnica das disciplinas processuais:** "Processo Civil" → **"Direito Processual Civil"**; "Processo do Trabalho" → **"Direito Processual do Trabalho"** (denominação correta; aliases mantidos).
3. **Distribuição R-04:** **confirmada sem erro** — soma 80, pesos batem com o solicitado. Nenhuma correção de número.
4. **Nenhum subtema inventado:** toda a taxonomia traça aos diplomas vigentes no corte (Art. IV — No Invention da Constitution AIOX).
5. **PL 4/2025 (novo Código Civil):** explicitamente marcado como **NÃO vigente** no corte — correção preventiva contra material desatualizado que já circula tratando-o como lei.

---

## 8. Notas de handoff para @data-engineer (Dara)

- Slugs são as chaves estáveis de seed; gerar IDs (uuid ou serial) no `INSERT`, mantendo `slug` como coluna UNIQUE para idempotência do seed e re-tagging.
- `materias.questoes_por_prova` alimenta o **peso de incidência** do weakness score (§8.3) e do planner (§8.4) — não é cosmético.
- Dimensões: `chave` UNIQUE; `dimensao_valores` só para `tipo='categorica'`. Booleanas/numéricas não populam `dimensao_valores`.
- `reform_sensitive=true` + a tabela §5 são a interface da taxonomia com o **Motor de Validade (Drop 3)**.
- O conjunto de dimensões é **aberto**: o Motor de Descoberta (§8.5) fará `INSERT` em `dimensoes` em runtime. Não criar constraint que impeça novas chaves.
- Sugestão de seed em ordem: `materias` → `subtemas` (FK materia) → `micro_topicos` (FK subtema) → `dimensoes` → `dimensao_valores` (FK dimensao).

---

⚠️ Esta análise é orientativa e não substitui consulta com advogado.
Para questões específicas, consulte um profissional habilitado.

---

### Fontes (validação de currency jurídica)
- [Senado — Reforma do Código Civil (PL 4/2025) pode avançar em 2026](https://www12.senado.leg.br/noticias/materias/2026/01/20/reforma-do-codigo-civil-pode-avancar-no-senado-em-2026)
- [Senado — Comissão prevê conclusão do CC até julho de 2026](https://www12.senado.leg.br/noticias/materias/2025/10/01/codigo-civil-comissao-aprova-plano-e-preve-conclusao-ate-julho-de-2026)
- [Câmara — Reforma tributária inicia transição com testes em 2026](https://www.camara.leg.br/noticias/1237089-reforma-tributaria-comeca-fase-de-transicao-com-testes-de-novos-impostos-em-2026/)
- [Senado — Novos tributos testados em 2026, transição até 2033](https://www12.senado.leg.br/noticias/materias/2024/12/16/novos-tributos-comecam-a-ser-testados-em-2026-e-transicao-vai-ate-2033)
- [STF — Juiz das garantias obrigatório (ADIs 6298/6299/6300/6305)](https://portal.stf.jus.br/noticias/verNoticiaDetalhe.asp?idConteudo=512751&ori=1)
- [Provimento CFOAB 205/2021 — publicidade e marketing jurídico](https://eticaedisciplina.oab.org.br/provimento)
- [Planalto — Lei 14.112/2020 (reforma falimentar)](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14112.htm)
- Base factual de distribuição/incidência: `kamile-oab/02-RESEARCH-exam-and-sources.md` (R-04, R-05)
