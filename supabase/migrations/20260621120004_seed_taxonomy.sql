-- =============================================================================
-- Advoga — Seed: Taxonomia OAB 1ª Fase
-- Migration: 20260621120004_seed_taxonomy.sql
-- Author: Dara (@data-engineer) · 2026-06-21
-- Depends on: 20260621120000, 120003 (slug columns)
-- Source: docs/taxonomy/oab-1fase-taxonomy.md (legal-chief, Opus, 2026-06-21)
-- =============================================================================
-- CONTEÚDO
--   § 1: materias (20 linhas) — INSERT ... ON CONFLICT (slug) DO NOTHING
--   § 2: subtemas (192 linhas) — INSERT ... ON CONFLICT (slug) DO NOTHING
--   § 3: micro_topicos (63 linhas em 7 subtemas semente) — ON CONFLICT DO NOTHING
--   § 4: dimensoes (12 linhas) — INSERT ... ON CONFLICT (chave) DO NOTHING
--   § 5: dimensao_valores (6 linhas, estilo_cognitivo) — ON CONFLICT DO NOTHING
--
-- IDEMPOTÊNCIA
--   ON CONFLICT (slug) DO NOTHING  → re-rodar não duplica, não sobrescreve nomes.
--   Ordem de INSERT respeita FKs: materias → subtemas → micro_topicos → dimensoes → dimensao_valores.
--
-- SLUGS como chave natural estável:
--   Toda linha é identificada pelo slug snake_case (definido na taxonomy doc).
--   UUIDs são gerados pelo banco (gen_random_uuid()). O seed referencia UUIDs
--   de materias/subtemas via subquery pelo slug (nunca hardcoda UUID).
--
-- NOTA JURÍDICA (corte 25/05/2026):
--   Nomes e pesos conforme edital 47º EOU FGV.
--   Nomenclatura de Ética corrigida: "Estatuto da Advocacia e da OAB, Regulamento Geral
--   e Código de Ética e Disciplina" (legal-chief §7 da taxonomy doc).
-- =============================================================================

BEGIN;

-- =============================================================================
-- § 1. MATERIAS (20 disciplinas OAB 1ª fase)
--   grupo A: 6 disciplinas = 38 questões
--   grupo B: 5 disciplinas = 24 questões
--   grupo C: 9 disciplinas = 18 questões
--   TOTAL: 80 questões ✓
-- =============================================================================
INSERT INTO public.materias (slug, nome, grupo, questoes_por_prova) VALUES

-- GRUPO A (alta incidência, ROI máximo)
('etica_estatuto',
 'Estatuto da Advocacia e da OAB, Regulamento Geral e Código de Ética e Disciplina',
 'A', 8),

('direito_constitucional',
 'Direito Constitucional',
 'A', 6),

('direito_civil',
 'Direito Civil',
 'A', 6),

('processo_civil',
 'Direito Processual Civil',
 'A', 6),

('direito_penal',
 'Direito Penal',
 'A', 6),

('processo_penal',
 'Direito Processual Penal',
 'A', 6),

-- GRUPO B (incidência intermediária)
('direito_administrativo',
 'Direito Administrativo',
 'B', 5),

('direito_tributario',
 'Direito Tributário',
 'B', 5),

('direito_trabalho',
 'Direito do Trabalho',
 'B', 5),

('processo_trabalho',
 'Direito Processual do Trabalho',
 'B', 5),

('direito_empresarial',
 'Direito Empresarial',
 'B', 4),

-- GRUPO C (menor incidência, 2q cada)
('direitos_humanos',
 'Direitos Humanos',
 'C', 2),

('direito_internacional',
 'Direito Internacional',
 'C', 2),

('direito_ambiental',
 'Direito Ambiental',
 'C', 2),

('direito_consumidor',
 'Direito do Consumidor',
 'C', 2),

('direito_eleitoral',
 'Direito Eleitoral',
 'C', 2),

('direito_financeiro',
 'Direito Financeiro',
 'C', 2),

('direito_previdenciario',
 'Direito Previdenciário',
 'C', 2),

('eca',
 'Estatuto da Criança e do Adolescente (ECA)',
 'C', 2),

('filosofia_direito',
 'Filosofia do Direito',
 'C', 2)

ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- § 2. SUBTEMAS (192 total, distribuídos pelas 20 matérias)
--   Referencia materia por slug via subquery — UUID gerado pelo banco.
--   ON CONFLICT (slug) — slug é UNIQUE global em subtemas (migration 120003).
-- =============================================================================

-- ---------------- 2.1 etica_estatuto (13 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'etica_estatuto'),
       v.nome
FROM (VALUES
  ('etica_advocacia_atividade',         'Advocacia: conceito, atividade privativa e exercício'),
  ('etica_inscricao',                   'Inscrição na OAB (principal e suplementar) e requisitos'),
  ('etica_incompatibilidades_impedimentos', 'Incompatibilidades e impedimentos'),
  ('etica_direitos_prerrogativas',      'Direitos e prerrogativas do advogado (Arts. 6º e 7º)'),
  ('etica_honorarios',                  'Honorários advocatícios (contratuais, sucumbenciais, arbitrados)'),
  ('etica_sociedade_advogados',         'Sociedade de advogados e sociedade unipessoal'),
  ('etica_deveres_sigilo',              'Deveres do advogado e sigilo profissional'),
  ('etica_publicidade',                 'Publicidade e marketing jurídico'),
  ('etica_infracoes_sancoes',           'Infrações e sanções disciplinares (censura, suspensão, exclusão, multa)'),
  ('etica_processo_disciplinar',        'Processo disciplinar e prescrição'),
  ('etica_oab_institucional',           'OAB institucional (Conselhos, órgãos, eleições, TED)'),
  ('etica_relacoes',                    'Relações com cliente, colegas, magistratura e parte contrária'),
  ('etica_advocacia_publica_dativa',    'Advocacia pública, defensoria dativa e honorários do dativo')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.2 direito_constitucional (13 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_constitucional'),
       v.nome
FROM (VALUES
  ('const_teoria_constituicao',           'Teoria da Constituição, poder constituinte e classificação'),
  ('const_principios_fundamentais',       'Princípios fundamentais (Arts. 1º-4º)'),
  ('const_direitos_garantias',            'Direitos e garantias fundamentais (Art. 5º)'),
  ('const_remedios_constitucionais',      'Remédios constitucionais (HC, MS, MI, HD, ação popular)'),
  ('const_direitos_sociais',              'Direitos sociais, nacionalidade e direitos políticos'),
  ('const_organizacao_estado',            'Organização do Estado e repartição de competências'),
  ('const_administracao_publica_const',   'Administração pública na CF (Art. 37 e ss.)'),
  ('const_poder_legislativo',             'Poder Legislativo e processo legislativo'),
  ('const_poder_executivo',               'Poder Executivo'),
  ('const_poder_judiciario',              'Poder Judiciário e funções essenciais à Justiça'),
  ('const_controle_constitucionalidade',  'Controle de constitucionalidade (difuso e concentrado)'),
  ('const_ordem_social_economica',        'Ordem social e ordem econômica e financeira'),
  ('const_defesa_estado',                 'Defesa do Estado e das instituições democráticas')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.3 direito_civil (11 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_civil'),
       v.nome
FROM (VALUES
  ('civ_lindb',                  'LINDB (Lei de Introdução às Normas do Direito Brasileiro)'),
  ('civ_parte_geral',            'Parte Geral: pessoas, bens, fatos e negócios jurídicos'),
  ('civ_obrigacoes',             'Direito das Obrigações'),
  ('civ_responsabilidade_civil', 'Responsabilidade civil'),
  ('civ_contratos_geral',        'Teoria geral dos contratos'),
  ('civ_contratos_especie',      'Contratos em espécie'),
  ('civ_atos_unilaterais',       'Atos unilaterais e responsabilidade pré/pós-contratual'),
  ('civ_direito_coisas',         'Direito das Coisas (reais)'),
  ('civ_familia',                'Direito de Família'),
  ('civ_sucessoes',              'Direito das Sucessões'),
  ('civ_registros_publicos',     'Registros públicos e prova')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.4 processo_civil (15 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'processo_civil'),
       v.nome
FROM (VALUES
  ('pc_normas_fundamentais',        'Normas fundamentais e aplicação do CPC'),
  ('pc_jurisdicao_acao',            'Jurisdição, ação e elementos'),
  ('pc_competencia',                'Competência'),
  ('pc_partes_litisconsorcio',      'Partes, litisconsórcio, intervenção de terceiros'),
  ('pc_atos_prazos_nulidades',      'Atos processuais, prazos e nulidades'),
  ('pc_tutela_provisoria',          'Tutela provisória (urgência e evidência)'),
  ('pc_processo_conhecimento',      'Processo de conhecimento e procedimento comum'),
  ('pc_provas',                     'Teoria geral das provas'),
  ('pc_sentenca_coisa_julgada',     'Sentença, coisa julgada e remessa necessária'),
  ('pc_recursos',                   'Recursos'),
  ('pc_cumprimento_sentenca',       'Cumprimento de sentença'),
  ('pc_execucao',                   'Processo de execução (título extrajudicial)'),
  ('pc_procedimentos_especiais',    'Procedimentos especiais'),
  ('pc_juizados_especiais_civeis',  'Juizados Especiais Cíveis (Lei 9.099/95)'),
  ('pc_precedentes',                'Precedentes, IRDR e ordem dos processos nos tribunais')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.5 direito_penal (14 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_penal'),
       v.nome
FROM (VALUES
  ('pen_aplicacao_lei_penal',            'Aplicação da lei penal (tempo, espaço, anterioridade)'),
  ('pen_teoria_crime',                   'Teoria do crime (fato típico, ilicitude, culpabilidade)'),
  ('pen_excludentes',                    'Excludentes de ilicitude e de culpabilidade'),
  ('pen_concurso_pessoas',               'Concurso de pessoas'),
  ('pen_concurso_crimes',                'Concurso de crimes'),
  ('pen_penas',                          'Penas: espécies, aplicação (dosimetria) e regimes'),
  ('pen_medidas_seguranca',              'Medidas de segurança'),
  ('pen_extincao_punibilidade',          'Extinção da punibilidade e prescrição'),
  ('pen_crimes_contra_pessoa',           'Crimes contra a pessoa (vida, lesão, honra)'),
  ('pen_crimes_contra_patrimonio',       'Crimes contra o patrimônio'),
  ('pen_crimes_contra_adm_publica',      'Crimes contra a Administração Pública'),
  ('pen_crimes_contra_dignidade_sexual', 'Crimes contra a dignidade sexual'),
  ('pen_crimes_contra_fe_publica',       'Crimes contra a fé pública e a coletividade'),
  ('pen_legislacao_especial',            'Legislação penal especial (drogas, ECA penal, Maria da Penha, tortura)')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.6 processo_penal (13 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'processo_penal'),
       v.nome
FROM (VALUES
  ('pp_inquerito_policial',        'Inquérito policial e investigação criminal'),
  ('pp_acao_penal',                'Ação penal (pública e privada) e ANPP'),
  ('pp_juiz_garantias',            'Juiz das garantias e competência'),
  ('pp_jurisdicao_competencia',    'Jurisdição e competência criminal'),
  ('pp_provas_penais',             'Provas no processo penal'),
  ('pp_prisao_medidas_cautelares', 'Prisão e medidas cautelares (incl. audiência de custódia)'),
  ('pp_sujeitos_processuais',      'Sujeitos processuais e atos processuais'),
  ('pp_procedimentos',             'Procedimentos (comum, sumário, sumaríssimo, júri)'),
  ('pp_nulidades',                 'Nulidades'),
  ('pp_recursos_penais',           'Recursos'),
  ('pp_acoes_autonomas',           'Ações autônomas de impugnação (HC, revisão criminal, MS)'),
  ('pp_execucao_penal',            'Execução penal (LEP)'),
  ('pp_juizados_criminais',        'Juizados Especiais Criminais (Lei 9.099/95)')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.7 direito_administrativo (13 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_administrativo'),
       v.nome
FROM (VALUES
  ('adm_regime_principios',             'Regime jurídico-administrativo e princípios'),
  ('adm_organizacao',                   'Organização administrativa (direta, indireta, terceiro setor)'),
  ('adm_poderes',                       'Poderes administrativos'),
  ('adm_atos_administrativos',          'Atos administrativos'),
  ('adm_licitacoes',                    'Licitações'),
  ('adm_contratos_administrativos',     'Contratos administrativos'),
  ('adm_servicos_publicos',             'Serviços públicos e concessões/permissões'),
  ('adm_agentes_publicos',              'Agentes públicos'),
  ('adm_responsabilidade_civil_estado', 'Responsabilidade civil do Estado'),
  ('adm_bens_publicos',                 'Bens públicos e intervenção na propriedade'),
  ('adm_improbidade',                   'Improbidade administrativa'),
  ('adm_controle',                      'Controle da Administração e processo administrativo'),
  ('adm_poder_policia',                 'Poder de polícia e ordenação administrativa')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.8 direito_tributario (10 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_tributario'),
       v.nome
FROM (VALUES
  ('trib_sistema_constitucional',    'Sistema tributário constitucional e competência'),
  ('trib_limitacoes_poder_tributar', 'Limitações ao poder de tributar (princípios e imunidades)'),
  ('trib_tributos_especies',         'Tributos e suas espécies (impostos, taxas, contribuições)'),
  ('trib_obrigacao_tributaria',      'Obrigação tributária (fato gerador, sujeição)'),
  ('trib_responsabilidade_tributaria','Responsabilidade tributária'),
  ('trib_credito_tributario',        'Crédito tributário, lançamento, suspensão/extinção/exclusão'),
  ('trib_administracao_tributaria',  'Administração tributária e garantias/privilégios do crédito'),
  ('trib_impostos_especie',          'Impostos em espécie (federais, estaduais, municipais)'),
  ('trib_processo_tributario',       'Processo tributário (administrativo e judicial)'),
  ('trib_simples_nacional',          'Simples Nacional e regimes especiais')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.9 direito_trabalho (14 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_trabalho'),
       v.nome
FROM (VALUES
  ('trab_principios_fontes',              'Princípios e fontes do Direito do Trabalho'),
  ('trab_relacao_emprego',                'Relação de emprego e sujeitos (empregado, empregador)'),
  ('trab_contrato_trabalho',              'Contrato de trabalho: modalidades e alteração'),
  ('trab_terceirizacao',                  'Terceirização e trabalho temporário'),
  ('trab_remuneracao_salario',            'Remuneração e salário'),
  ('trab_jornada',                        'Jornada de trabalho, intervalos e horas extras'),
  ('trab_ferias_repouso',                 'Férias e repouso semanal remunerado'),
  ('trab_fgts',                           'FGTS'),
  ('trab_alteracao_suspensao_interrupcao','Suspensão e interrupção do contrato'),
  ('trab_extincao_contrato',              'Extinção do contrato e verbas rescisórias'),
  ('trab_estabilidade_garantias',         'Estabilidade e garantias de emprego'),
  ('trab_seguranca_medicina',             'Segurança e medicina do trabalho; insalubridade/periculosidade'),
  ('trab_direito_coletivo',               'Direito coletivo (sindicatos, negociação, greve)'),
  ('trab_trabalhos_especiais',            'Contratos e trabalhos especiais (rural, doméstico, aprendiz)')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.10 processo_trabalho (12 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'processo_trabalho'),
       v.nome
FROM (VALUES
  ('pt_organizacao_justica_trabalho', 'Organização e competência da Justiça do Trabalho'),
  ('pt_principios',                   'Princípios do processo do trabalho e aplicação subsidiária do CPC'),
  ('pt_partes_representacao',         'Partes, jus postulandi e representação'),
  ('pt_dissidios',                    'Dissídio individual e dissídio coletivo'),
  ('pt_procedimentos',                'Procedimentos (ordinário, sumaríssimo, sumário)'),
  ('pt_audiencia',                    'Audiência, conciliação e revelia'),
  ('pt_provas_trab',                  'Provas no processo do trabalho e ônus da prova'),
  ('pt_sentenca_custas',              'Sentença, custas e honorários'),
  ('pt_recursos_trab',                'Recursos trabalhistas'),
  ('pt_execucao_trab',                'Execução trabalhista'),
  ('pt_acoes_especiais_trab',         'Ações especiais (MS, ação rescisória, AR, inquérito)'),
  ('pt_nulidades_prescricao',         'Nulidades e prescrição trabalhista')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.11 direito_empresarial (10 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_empresarial'),
       v.nome
FROM (VALUES
  ('emp_teoria_empresa',              'Teoria da empresa, empresário e EIRELI/empresário individual'),
  ('emp_registro_nome_estabelecimento','Registro de empresa, nome empresarial e estabelecimento'),
  ('emp_sociedades_geral',            'Direito societário: teoria geral e tipos'),
  ('emp_sociedade_limitada',          'Sociedade limitada'),
  ('emp_sociedade_anonima',           'Sociedade anônima'),
  ('emp_titulos_credito',             'Títulos de crédito'),
  ('emp_contratos_empresariais',      'Contratos empresariais'),
  ('emp_falencia_recuperacao',        'Falência e recuperação judicial/extrajudicial'),
  ('emp_propriedade_industrial',      'Propriedade industrial (Lei 9.279/96)'),
  ('emp_direito_concorrencial',       'Direito concorrencial e empresarial digital')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.12 direitos_humanos (5 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direitos_humanos'),
       v.nome
FROM (VALUES
  ('dh_teoria_geral',          'Teoria geral, dimensões e características dos DH'),
  ('dh_sistema_global',        'Sistema global (ONU): DUDH e pactos'),
  ('dh_sistema_interamericano','Sistema interamericano (Pacto de San José, Corte IDH)'),
  ('dh_incorporacao_interna',  'Incorporação ao direito interno e status dos tratados (EC 45/2004)'),
  ('dh_grupos_vulneraveis',    'Proteção de grupos vulneráveis')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.13 direito_internacional (6 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_internacional'),
       v.nome
FROM (VALUES
  ('int_fontes_tratados',         'Fontes e tratados internacionais (Convenção de Viena)'),
  ('int_sujeitos',                'Sujeitos de direito internacional e organizações'),
  ('int_publico_geral',           'Direito internacional público (nacionalidade, asilo, extradição)'),
  ('int_privado_lindb',           'Direito internacional privado (LINDB, elementos de conexão)'),
  ('int_cooperacao_processual',   'Cooperação jurídica internacional e homologação de sentença estrangeira'),
  ('int_comercio_integracao',     'Comércio internacional e integração (Mercosul)')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.14 direito_ambiental (6 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_ambiental'),
       v.nome
FROM (VALUES
  ('amb_principios_pnma',          'Princípios e Política Nacional do Meio Ambiente (Lei 6.938/81)'),
  ('amb_competencias',             'Competências ambientais (LC 140/2011)'),
  ('amb_licenciamento',            'Licenciamento ambiental e estudo de impacto'),
  ('amb_responsabilidade_ambiental','Responsabilidade ambiental (civil, penal, administrativa)'),
  ('amb_codigo_florestal',         'Código Florestal (Lei 12.651/2012), APP e reserva legal'),
  ('amb_tutela_processual',        'Tutela processual (ACP, competência)')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.15 direito_consumidor (7 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_consumidor'),
       v.nome
FROM (VALUES
  ('cdc_relacao_consumo',     'Relação de consumo: consumidor, fornecedor, produto/serviço'),
  ('cdc_direitos_basicos',    'Direitos básicos do consumidor'),
  ('cdc_responsabilidade',    'Responsabilidade por vício e por fato do produto/serviço'),
  ('cdc_praticas_comerciais', 'Práticas comerciais, oferta e publicidade'),
  ('cdc_clausulas_abusivas',  'Cláusulas abusivas e proteção contratual'),
  ('cdc_superendividamento',  'Superendividamento (Lei 14.181/2021)'),
  ('cdc_defesa_juizo',        'Defesa do consumidor em juízo e tutela coletiva')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.16 direito_eleitoral (6 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_eleitoral'),
       v.nome
FROM (VALUES
  ('ele_direitos_politicos',   'Direitos políticos e organização da Justiça Eleitoral'),
  ('ele_alistamento_filiacao', 'Alistamento, filiação partidária e domicílio'),
  ('ele_inelegibilidades',     'Condições de elegibilidade e inelegibilidades (LC 64/90)'),
  ('ele_registro_candidatura', 'Registro de candidatura e convenções'),
  ('ele_propaganda',           'Propaganda eleitoral e condutas vedadas'),
  ('ele_processo_crimes',      'Processo eleitoral, AIJE/AIME e crimes eleitorais')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.17 direito_financeiro (6 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_financeiro'),
       v.nome
FROM (VALUES
  ('fin_atividade_financeira', 'Atividade financeira do Estado e competências'),
  ('fin_orcamento',            'Orçamento público (PPA, LDO, LOA) e princípios orçamentários'),
  ('fin_receita_despesa',      'Receita e despesa pública'),
  ('fin_credito_divida',       'Crédito público e dívida pública'),
  ('fin_lrf',                  'Lei de Responsabilidade Fiscal (LC 101/2000)'),
  ('fin_fiscalizacao',         'Fiscalização e controle financeiro (Tribunais de Contas)')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.18 direito_previdenciario (6 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'direito_previdenciario'),
       v.nome
FROM (VALUES
  ('prev_seguridade_principios', 'Seguridade social: conceito, princípios e custeio'),
  ('prev_segurados_dependentes', 'Segurados e dependentes do RGPS'),
  ('prev_beneficios',            'Benefícios previdenciários (espécies e requisitos)'),
  ('prev_aposentadorias',        'Aposentadorias e regras de transição'),
  ('prev_acidente_trabalho',     'Benefícios por incapacidade e acidente de trabalho'),
  ('prev_assistencia_social',    'Assistência social (LOAS/BPC)')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.19 eca (6 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'eca'),
       v.nome
FROM (VALUES
  ('eca_principios_direitos',  'Princípios, proteção integral e direitos fundamentais da criança/adolescente'),
  ('eca_medidas_protecao',     'Medidas de proteção'),
  ('eca_ato_infracional',      'Ato infracional e medidas socioeducativas'),
  ('eca_familia_convivencia',  'Direito à convivência familiar (guarda, tutela, adoção)'),
  ('eca_conselho_tutelar',     'Conselho Tutelar e política de atendimento'),
  ('eca_acesso_justica_crimes','Acesso à Justiça e crimes contra crianças/adolescentes')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- ---------------- 2.20 filosofia_direito (6 subtemas) ----------------
INSERT INTO public.subtemas (slug, materia_id, nome)
SELECT v.slug,
       (SELECT id FROM public.materias WHERE slug = 'filosofia_direito'),
       v.nome
FROM (VALUES
  ('fil_conceito_direito',            'Conceito de Direito e teorias da norma'),
  ('fil_jusnaturalismo_positivismo',  'Jusnaturalismo, positivismo e pós-positivismo'),
  ('fil_justica',                     'Teorias da justiça'),
  ('fil_interpretacao_argumentacao',  'Interpretação, argumentação jurídica e hermenêutica'),
  ('fil_etica_moral_direito',         'Ética, moral e direito'),
  ('fil_sociologia_juridica',         'Sociologia jurídica e eficácia social da norma')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- § 3. MICRO_TOPICOS (63 total — semente Drop 2, alta incidência)
--   7 subtemas: civ_direito_coisas(13), trib_obrigacao_tributaria(10),
--               etica_honorarios(7), pc_recursos(9), pp_recursos_penais(7),
--               trab_extincao_contrato(9), pen_penas(8)
-- =============================================================================

-- 3.1 civ_direito_coisas (13 micro-tópicos)
INSERT INTO public.micro_topicos (slug, subtema_id, nome)
SELECT v.slug,
       (SELECT id FROM public.subtemas WHERE slug = 'civ_direito_coisas'),
       v.nome
FROM (VALUES
  ('coisas_posse_conceito',         'Posse: conceito e classificações'),
  ('coisas_posse_direta',           'Posse direta'),
  ('coisas_posse_indireta',         'Posse indireta'),
  ('coisas_composse',               'Composse'),
  ('coisas_posse_justa_injusta',    'Posse justa e injusta (violência, clandestinidade, precariedade)'),
  ('coisas_posse_boa_ma_fe',        'Posse de boa-fé e de má-fé'),
  ('coisas_efeitos_posse',          'Efeitos da posse (interditos possessórios, frutos, benfeitorias)'),
  ('coisas_propriedade',            'Propriedade: conceito, atributos e função social'),
  ('coisas_aquisicao_propriedade',  'Aquisição da propriedade (usucapião, registro, acessão, tradição)'),
  ('coisas_usucapiao',              'Usucapião (modalidades e requisitos)'),
  ('coisas_direitos_reais_gozo',    'Direitos reais sobre coisa alheia: gozo/fruição (servidão, usufruto, superfície)'),
  ('coisas_direitos_reais_garantia','Direitos reais de garantia (penhor, hipoteca, anticrese)'),
  ('coisas_condominio',             'Condomínio (geral e edilício)')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- 3.2 trib_obrigacao_tributaria (10 micro-tópicos)
INSERT INTO public.micro_topicos (slug, subtema_id, nome)
SELECT v.slug,
       (SELECT id FROM public.subtemas WHERE slug = 'trib_obrigacao_tributaria'),
       v.nome
FROM (VALUES
  ('obtrib_regra_matriz',                   'Regra-matriz de incidência tributária'),
  ('obtrib_criterio_material',              'Critério material da hipótese de incidência'),
  ('obtrib_criterio_espacial',              'Critério espacial'),
  ('obtrib_criterio_temporal',              'Critério temporal'),
  ('obtrib_criterio_pessoal',               'Critério pessoal (sujeito ativo e passivo)'),
  ('obtrib_criterio_quantitativo',          'Critério quantitativo (base de cálculo e alíquota)'),
  ('obtrib_fato_gerador',                   'Fato gerador (principal e acessória)'),
  ('obtrib_sujeito_passivo',                'Sujeito passivo: contribuinte e responsável'),
  ('obtrib_obrigacao_principal_acessoria',  'Obrigação principal x acessória'),
  ('obtrib_domicilio_tributario',           'Domicílio tributário')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- 3.3 etica_honorarios (7 micro-tópicos)
INSERT INTO public.micro_topicos (slug, subtema_id, nome)
SELECT v.slug,
       (SELECT id FROM public.subtemas WHERE slug = 'etica_honorarios'),
       v.nome
FROM (VALUES
  ('hon_contratuais',         'Honorários contratuais'),
  ('hon_sucumbenciais',       'Honorários de sucumbência (titularidade do advogado)'),
  ('hon_arbitrados',          'Honorários arbitrados judicialmente'),
  ('hon_natureza_alimentar',  'Natureza alimentar e impenhorabilidade'),
  ('hon_quota_litis',         'Contrato de êxito (quota litis) e limites'),
  ('hon_dativo',              'Honorários do advogado dativo'),
  ('hon_prescricao_cobranca', 'Prescrição e ação de cobrança de honorários')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- 3.4 pc_recursos (9 micro-tópicos)
INSERT INTO public.micro_topicos (slug, subtema_id, nome)
SELECT v.slug,
       (SELECT id FROM public.subtemas WHERE slug = 'pc_recursos'),
       v.nome
FROM (VALUES
  ('rec_principios',             'Princípios recursais (fungibilidade, dialeticidade, non reformatio in pejus)'),
  ('rec_efeitos',                'Efeitos dos recursos (devolutivo, suspensivo, translativo)'),
  ('rec_apelacao',               'Apelação'),
  ('rec_agravo_instrumento',     'Agravo de instrumento'),
  ('rec_agravo_interno',         'Agravo interno'),
  ('rec_embargos_declaracao',    'Embargos de declaração'),
  ('rec_recurso_especial',       'Recurso especial (STJ)'),
  ('rec_recurso_extraordinario', 'Recurso extraordinário e repercussão geral (STF)'),
  ('rec_recursos_repetitivos',   'Recursos repetitivos e juízo de admissibilidade')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- 3.5 pp_recursos_penais (7 micro-tópicos)
INSERT INTO public.micro_topicos (slug, subtema_id, nome)
SELECT v.slug,
       (SELECT id FROM public.subtemas WHERE slug = 'pp_recursos_penais'),
       v.nome
FROM (VALUES
  ('recpp_disposicoes_gerais',    'Disposições gerais e pressupostos recursais'),
  ('recpp_apelacao_criminal',     'Apelação criminal'),
  ('recpp_rese',                  'Recurso em sentido estrito (RESE)'),
  ('recpp_embargos',              'Embargos de declaração e embargos infringentes'),
  ('recpp_carta_testemunhavel',   'Carta testemunhável'),
  ('recpp_agravo_execucao',       'Agravo em execução'),
  ('recpp_recursos_excepcionais', 'Recursos aos tribunais superiores (REsp, RE)')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- 3.6 trab_extincao_contrato (9 micro-tópicos)
INSERT INTO public.micro_topicos (slug, subtema_id, nome)
SELECT v.slug,
       (SELECT id FROM public.subtemas WHERE slug = 'trab_extincao_contrato'),
       v.nome
FROM (VALUES
  ('ext_dispensa_sem_justa_causa', 'Dispensa sem justa causa'),
  ('ext_dispensa_justa_causa',     'Dispensa por justa causa (Art. 482)'),
  ('ext_pedido_demissao',          'Pedido de demissão'),
  ('ext_rescisao_indireta',        'Rescisão indireta (Art. 483)'),
  ('ext_distrato',                 'Distrato / acordo (Art. 484-A)'),
  ('ext_culpa_reciproca',          'Culpa recíproca'),
  ('ext_verbas_rescisorias',       'Verbas rescisórias e prazos de pagamento'),
  ('ext_aviso_previo',             'Aviso prévio (trabalhado e indenizado; proporcional)'),
  ('ext_homologacao_quitacao',     'Homologação e quitação anual')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- 3.7 pen_penas (8 micro-tópicos)
INSERT INTO public.micro_topicos (slug, subtema_id, nome)
SELECT v.slug,
       (SELECT id FROM public.subtemas WHERE slug = 'pen_penas'),
       v.nome
FROM (VALUES
  ('penas_especies',                    'Espécies de pena (privativa, restritiva de direitos, multa)'),
  ('penas_dosimetria_trifasica',        'Dosimetria trifásica (Art. 68)'),
  ('penas_circunstancias_judiciais',    'Circunstâncias judiciais (Art. 59)'),
  ('penas_agravantes_atenuantes',       'Agravantes e atenuantes'),
  ('penas_causas_aumento_diminuicao',   'Causas de aumento e de diminuição'),
  ('penas_regimes',                     'Regimes de cumprimento e progressão'),
  ('penas_substituicao',                'Substituição por restritivas de direitos e sursis'),
  ('penas_livramento_condicional',      'Livramento condicional')
) AS v(slug, nome)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- § 4. DIMENSOES (12 eixos transversais — semente aberta)
--   chave = UNIQUE (migration 120000) — ON CONFLICT (chave) DO NOTHING.
--   Booleanas e numéricas NÃO têm dimensao_valores.
--   O conjunto é ABERTO: Motor de Descoberta (§8.5) adiciona mais via INSERT.
-- =============================================================================
INSERT INTO public.dimensoes (chave, nome, tipo, descricao, ativa) VALUES

('estilo_cognitivo',
 'Estilo cognitivo da questão',
 'categorica',
 'Como a questão exige raciocínio — eixo-âncora do diagnóstico cognitivo (Kamile)',
 true),

('comando_negativo',
 'Comando negativo',
 'booleana',
 'Enunciado pede a alternativa INCORRETA / EXCETO / NÃO',
 true),

('exige_calculo',
 'Exige cálculo',
 'booleana',
 'Resolver exige operação numérica (prazo, dosimetria, verba, alíquota)',
 true),

('enunciado_longo',
 'Enunciado longo',
 'booleana',
 'Caso/enunciado extenso (custo de leitura/atenção elevado)',
 true),

('dependencia_sumula',
 'Dependência de súmula/jurisprudência',
 'booleana',
 'Resposta depende de súmula (STF/STJ/TST) ou precedente vinculante',
 true),

('prazo_numerico',
 'Prazo / valor numérico',
 'booleana',
 'Acerto depende de memorizar prazo, quórum ou número específico',
 true),

('posicao_prova',
 'Posição na prova (fadiga)',
 'numerica',
 'Nº da questão (1-80) — proxy de fadiga; correlação com taxa de erro',
 true),

('interdisciplinar',
 'Interdisciplinaridade',
 'booleana',
 'Cruza mais de uma disciplina (ex.: Constitucional + Administrativo)',
 true),

('nivel_dificuldade_empirica',
 'Dificuldade empírica',
 'numerica',
 '% de erro observado (derivado das respostas; alimenta weakness score)',
 true),

('pegadinha_excecao',
 'Pegadinha de exceção',
 'booleana',
 'Acerto depende de identificar a exceção à regra geral',
 true),

('letra_de_lei_literal',
 'Cobrança de letra de lei literal',
 'booleana',
 'Resposta é transcrição quase literal de dispositivo',
 true),

('reform_sensitive',
 'Sensível a reforma',
 'booleana',
 'Toca dispositivo alterado por reforma recente — gatilho para o Motor de Validade (Drop 3)',
 true)

ON CONFLICT (chave) DO NOTHING;

-- =============================================================================
-- § 5. DIMENSAO_VALORES (6 valores de estilo_cognitivo — única categórica semente)
--   ON CONFLICT (dimensao_id, valor) DO NOTHING.
-- =============================================================================
INSERT INTO public.dimensao_valores (dimensao_id, valor, ordem)
SELECT
  (SELECT id FROM public.dimensoes WHERE chave = 'estilo_cognitivo'),
  v.valor,
  v.ordem
FROM (VALUES
  ('letra-de-lei',         1),
  ('jurisprudencia-sumula', 2),
  ('caso-concreto',        3),
  ('pegadinha-exceto',     4),
  ('interdisciplinar',     5),
  ('doutrina',             6)
) AS v(valor, ordem)
ON CONFLICT (dimensao_id, valor) DO NOTHING;

COMMIT;

-- =============================================================================
-- CONTAGEM FINAL (verificação):
--   materias:         20 linhas
--   subtemas:        192 linhas (13+13+11+15+14+13+13+10+14+12+10+5+6+6+7+6+6+6+6+6 = 192)
--   micro_topicos:    63 linhas (13+10+7+9+7+9+8 = 63)
--   dimensoes:        12 linhas
--   dimensao_valores:  6 linhas (todos em estilo_cognitivo)
--
-- PRÓXIMO PASSO:
--   supabase db push         → aplica as 4 migrations em ordem lexicográfica
--   supabase gen types typescript --local > src/lib/types/db.types.ts  (D-9)
-- =============================================================================
