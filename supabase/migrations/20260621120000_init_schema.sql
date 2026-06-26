-- =============================================================================
-- Advoga — Init Schema (EP-0 / Fase 0)
-- Migration: 20260621120000_init_schema.sql
-- Author: Dara (@data-engineer) · 2026-06-21
-- Source of truth: kamile-oab/01-BRIEF.md §8.2 (esboço de schema, CANÔNICO)
-- =============================================================================
-- PURPOSE
--   Guia de estudos OAB 1ª fase, data-driven, single-user (Kamile).
--   Implementa o "Motor de Diagnóstico" (§8) com DIMENSÕES TRANSVERSAIS ABERTAS.
--
-- PRINCÍPIO-CHAVE (D-06, §8.1/§8.5)
--   Dimensões transversais = conjunto ABERTO. Adicionar um eixo novo
--   (ex.: "exige cálculo?", "comando negativo?", "posição na prova?") é
--   um INSERT em `dimensoes` (+ `dimensao_valores` se categórica) — NUNCA
--   um ALTER TABLE. Isso é o coração do Motor de Descoberta (§8.5).
--   Modelo EAV: dimensoes / dimensao_valores / questao_tags.
--
-- MULTI-USER READINESS (D-01)
--   Single-user hoje (Kamile), mas TODA tabela de dados da usuária carrega
--   user_id (FK -> auth.users). Virar multi-user = remover defaults/limites,
--   sem retrabalho de schema. RLS vive em 20260621120002_rls_single_user.sql.
--
-- ANTI-CHUTE (§4, gate de volume)
--   O schema é a camada de FATOS (respostas vs gabarito). O gate de volume
--   (n_feitas >= 8 antes de declarar fraqueza) é aplicado nas VIEWS de
--   diagnóstico (20260621120001), nunca como verdade hard-coded aqui.
--
-- IDEMPOTÊNCIA
--   Tudo usa IF NOT EXISTS / guards em DO-blocks. Seguro re-rodar.
--   Válido para `supabase db push` (local-first; mesmo DDL no cloud da Kamile).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. EXTENSÕES
--   pgcrypto -> gen_random_uuid() para PKs UUID (padrão Supabase).
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. TRIGGER HELPER — updated_at automático
--   Baseline Dara: toda tabela mutável ganha created_at + updated_at.
--   SECURITY: SET search_path explícito (evita hijack via search_path).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Trigger BEFORE UPDATE: mantém updated_at = now(). search_path travado por segurança.';

-- -----------------------------------------------------------------------------
-- 2. ENUMS (tipos fechados do domínio)
--   Guard via DO-block (CREATE TYPE não aceita IF NOT EXISTS).
--   NOTA: enums são intencionais aqui porque os DOMÍNIOS são fechados:
--     - grupo de matéria (A|B|C) -> fixo pela estrutura da prova OAB.
--     - validade_status -> conjunto legal definido (§8.1, Motor de Validade).
--     - tipo de prova / tipo de sessão / origem de tag -> fechados.
--   CONTRASTE: as DIMENSÕES TRANSVERSAIS NÃO são enum — são linhas (EAV),
--   justamente porque são um conjunto ABERTO (D-06).
-- -----------------------------------------------------------------------------

-- 2.1 Grupo de incidência da matéria (peso estratégico do planner, §6)
DO $$ BEGIN
  CREATE TYPE public.grupo_materia AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.2 Tipo do eixo de dimensão (governa qual coluna de valor em questao_tags)
DO $$ BEGIN
  CREATE TYPE public.dimensao_tipo AS ENUM ('categorica', 'booleana', 'numerica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.3 Status de validade legal da questão (corte 25/05/2026, §10 / Motor de Validade)
DO $$ BEGIN
  CREATE TYPE public.validade_status AS ENUM (
    'vigente',        -- presumida ou verificada como lei atual
    'desatualizada',  -- baseada em redação revogada/alterada
    'anulada',        -- anulada pela banca (gabarito definitivo)
    'em_revisao'      -- pendente de checagem (default seguro)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.4 Tipo de prova / exame
DO $$ BEGIN
  CREATE TYPE public.tipo_prova AS ENUM (
    'prova_oficial',  -- edição real da OAB
    'simulado',       -- montado a partir de questões reais
    'reaplicacao'     -- reaplicação oficial (ex.: PPL / casos especiais)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.5 Tipo de sessão de estudo (espelha tipo_prova + 'treino' avulso)
DO $$ BEGIN
  CREATE TYPE public.sessao_tipo AS ENUM (
    'prova_oficial',  -- fez uma edição inteira cronometrada
    'simulado',       -- simulado montado
    'treino'          -- treino avulso por tema/dimensão
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.6 Origem de uma tag de dimensão (rastreabilidade do Motor de Descoberta §8.5)
DO $$ BEGIN
  CREATE TYPE public.tag_origem AS ENUM (
    'humano',    -- revisão/curadoria humana
    'llm',       -- classificador LLM (ultracode fan-out)
    'minerado'   -- derivado por mineração/correlação (§8.5)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 3. EIXO DE CONTEÚDO (hierárquico): matéria -> subtema -> micro-tópico (§8.1)
-- =============================================================================

-- 3.1 MATERIAS — 20 disciplinas da prova; grupo + peso de incidência (§6)
--   questoes_por_prova = nº oficial de questões da disciplina na prova.
--   É o "peso de incidência" que o planner usa (incidência × fraqueza, §8.3/§8.4).
CREATE TABLE IF NOT EXISTS public.materias (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  grupo              public.grupo_materia NOT NULL,
  -- peso de incidência: quantas questões dessa matéria caem na prova (§6).
  -- CHECK >= 0: Grupo C tem disciplinas com 2; nunca negativo.
  questoes_por_prova smallint NOT NULL DEFAULT 0 CHECK (questoes_por_prova >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materias_nome_uniq UNIQUE (nome)
);

COMMENT ON TABLE  public.materias IS 'Disciplinas OAB 1ª fase (20). grupo A|B|C + peso de incidência (§6).';
COMMENT ON COLUMN public.materias.questoes_por_prova IS 'Peso de incidência: nº de questões da matéria na prova oficial. Usado pelo planner (incidência × fraqueza).';
COMMENT ON COLUMN public.materias.grupo IS 'Grupo estratégico: A (38q, alto ROI), B (24q), C (18q). Ver §6.';

-- 3.2 SUBTEMAS — nível intermediário (ex.: Civil -> Posse)
CREATE TABLE IF NOT EXISTS public.subtemas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_id  uuid NOT NULL REFERENCES public.materias(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- nome único DENTRO da matéria (não global): "Recursos" existe em vários ramos.
  CONSTRAINT subtemas_materia_nome_uniq UNIQUE (materia_id, nome)
);

COMMENT ON TABLE public.subtemas IS 'Subtema dentro de uma matéria (ex.: Civil -> Posse). Granularidade que vence agregados (§4).';

-- 3.3 MICRO_TOPICOS — folha da hierarquia (entra no banco no Drop 2, §9)
CREATE TABLE IF NOT EXISTS public.micro_topicos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtema_id  uuid NOT NULL REFERENCES public.subtemas(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT micro_topicos_subtema_nome_uniq UNIQUE (subtema_id, nome)
);

COMMENT ON TABLE public.micro_topicos IS 'Micro-tópico (folha): ex.: Posse -> "Posse de boa-fé". Alvo da repetição espaçada (§8.4).';

-- =============================================================================
-- 4. DIMENSÕES TRANSVERSAIS ABERTAS (EAV) — o coração da extensibilidade (D-06)
--   Adicionar um eixo novo = INSERT aqui. Nunca ALTER TABLE.
-- =============================================================================

-- 4.1 DIMENSOES — catálogo de eixos transversais
--   chave    -> slug estável para código/queries (ex.: 'estilo_cognitivo',
--               'exige_calculo', 'comando_negativo', 'posicao_prova').
--   tipo     -> governa qual coluna de valor é usada em questao_tags:
--               categorica -> valor_id   (FK -> dimensao_valores)
--               booleana   -> valor_bool
--               numerica   -> valor_num
CREATE TABLE IF NOT EXISTS public.dimensoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       text NOT NULL,
  nome        text NOT NULL,
  tipo        public.dimensao_tipo NOT NULL,
  descricao   text,
  -- ativa: permite "aposentar" uma dimensão minerada que não prediz erro,
  -- sem perder o histórico de tags já aplicadas (Motor de Descoberta, §8.5).
  ativa       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dimensoes_chave_uniq UNIQUE (chave)
);

COMMENT ON TABLE  public.dimensoes IS 'Catálogo ABERTO de eixos transversais (D-06). Novo eixo = novo INSERT, nunca ALTER. Base do Motor de Descoberta (§8.5).';
COMMENT ON COLUMN public.dimensoes.chave IS 'Slug estável p/ código (ex.: estilo_cognitivo, exige_calculo, comando_negativo).';
COMMENT ON COLUMN public.dimensoes.tipo IS 'categorica -> usa valor_id | booleana -> valor_bool | numerica -> valor_num em questao_tags.';
COMMENT ON COLUMN public.dimensoes.ativa IS 'false aposenta o eixo sem apagar tags históricas (descoberta que não prediz erro).';

-- 4.2 DIMENSAO_VALORES — domínio de valores p/ dimensões CATEGÓRICAS
--   Ex.: dimensão 'estilo_cognitivo' -> valores:
--        letra_de_lei | jurisprudencia | caso_concreto | pegadinha | interdisciplinar
CREATE TABLE IF NOT EXISTS public.dimensao_valores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimensao_id  uuid NOT NULL REFERENCES public.dimensoes(id) ON DELETE CASCADE,
  valor        text NOT NULL,
  ordem        smallint,  -- opcional: ordenação amigável em dashboards
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dimensao_valores_uniq UNIQUE (dimensao_id, valor)
);

COMMENT ON TABLE public.dimensao_valores IS 'Valores possíveis de uma dimensão categórica (ex.: estilo_cognitivo -> letra_de_lei|jurisprudencia|...).';

-- =============================================================================
-- 5. CONTEÚDO DE PROVA: exames + questões
-- =============================================================================

-- 5.1 EXAMES — uma edição da OAB (ou simulado/reaplicação)
CREATE TABLE IF NOT EXISTS public.exames (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_romano  text,                       -- ex.: 'XLVII' (47º). Texto p/ display fiel.
  ano            smallint CHECK (ano BETWEEN 2010 AND 2100),
  edicao         smallint,                    -- nº inteiro da edição (47)
  data           date,                        -- data de aplicação (se conhecida)
  tipo_prova     public.tipo_prova NOT NULL DEFAULT 'prova_oficial',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- evita duplicar a mesma edição oficial; simulados podem repetir edição NULL.
  CONSTRAINT exames_edicao_tipo_uniq UNIQUE (edicao, tipo_prova)
);

COMMENT ON TABLE  public.exames IS 'Edição de prova (oficial/simulado/reaplicação). Ingestão recente->antigo (D-02, §9).';
COMMENT ON COLUMN public.exames.numero_romano IS 'Numeração romana oficial (ex.: XLVII) para display fiel.';

-- 5.2 QUESTOES — a unidade central. Conteúdo + classificação + validade.
--   exame_id é NULLABLE: questão pode existir solta (ex.: importada antes de
--   amarrar à edição, ou item de banco genérico). FK SET NULL preserva a questão.
--   gabarito: char(1) em {A,B,C,D} (prova OAB tem 4 alternativas).
--   dificuldade: smallint NULLABLE -> dificuldade EMPÍRICA derivada do % de
--     acerto (§8.1). Fica NULL até haver respostas suficientes; preenchida por
--     job/diagnóstico. NÃO confundir com dificuldade declarada.
CREATE TABLE IF NOT EXISTS public.questoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exame_id         uuid REFERENCES public.exames(id) ON DELETE SET NULL,
  num_prova        smallint,                  -- posição na prova (1..80) -> dimensão fadiga
  enunciado        text NOT NULL,
  alt_a            text NOT NULL,
  alt_b            text NOT NULL,
  alt_c            text NOT NULL,
  alt_d            text NOT NULL,
  gabarito         char(1) NOT NULL CHECK (gabarito IN ('A','B','C','D')),

  -- eixo de conteúdo (matéria obrigatória; subtema/micro progressivos por drop)
  materia_id       uuid NOT NULL REFERENCES public.materias(id)      ON DELETE RESTRICT,
  subtema_id       uuid          REFERENCES public.subtemas(id)      ON DELETE SET NULL,
  micro_topico_id  uuid          REFERENCES public.micro_topicos(id) ON DELETE SET NULL,

  -- dificuldade empírica (0..100 = % de acerto invertido OU score calibrado).
  -- NULLABLE: só existe com amostra; preenchida por processo de diagnóstico.
  dificuldade      smallint CHECK (dificuldade BETWEEN 0 AND 100),

  -- validade legal (Motor de Validade, §3/§10). Default conservador.
  validade_status  public.validade_status NOT NULL DEFAULT 'em_revisao',
  validade_motivo  text,                      -- ex.: "redação anterior ao CPC/2015"
  fonte_url        text,                      -- PDF/portal de origem (FGV/OAB)

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- integridade hierárquica: micro só faz sentido com subtema.
  CONSTRAINT questoes_micro_requer_subtema
    CHECK (micro_topico_id IS NULL OR subtema_id IS NOT NULL),
  -- evita duplicata da mesma questão dentro de um exame.
  CONSTRAINT questoes_exame_num_uniq UNIQUE (exame_id, num_prova)
);

COMMENT ON TABLE  public.questoes IS 'Questão (enunciado + 4 alternativas + gabarito). Classificada por conteúdo + dimensões + validade. ~3.680 no destino (46×80).';
COMMENT ON COLUMN public.questoes.dificuldade IS 'Dificuldade EMPÍRICA (derivada do % de acerto, §8.1). NULL até haver amostra.';
COMMENT ON COLUMN public.questoes.validade_status IS 'Validade legal vs corte 25/05/2026. Default em_revisao (conservador). anulada vem do gabarito definitivo.';
COMMENT ON COLUMN public.questoes.num_prova IS 'Posição na prova (1..80). Alimenta a dimensão de fadiga/posição (§8.1).';

-- 5.3 QUESTAO_TAGS — EAV: N tags de dimensão por questão (§8.2)
--   Exatamente UMA das colunas de valor é preenchida, conforme dimensoes.tipo:
--     categorica -> valor_id    (FK dimensao_valores)
--     booleana   -> valor_bool
--     numerica   -> valor_num
--   origem -> rastreabilidade (humano|llm|minerado), essencial p/ §8.5.
--   confianca -> opcional: confiança do classificador LLM (0..1), p/ priorizar revisão.
CREATE TABLE IF NOT EXISTS public.questao_tags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questao_id   uuid NOT NULL REFERENCES public.questoes(id)         ON DELETE CASCADE,
  dimensao_id  uuid NOT NULL REFERENCES public.dimensoes(id)        ON DELETE CASCADE,
  valor_id     uuid          REFERENCES public.dimensao_valores(id) ON DELETE CASCADE,
  valor_bool   boolean,
  valor_num    numeric,
  origem       public.tag_origem NOT NULL DEFAULT 'llm',
  confianca    numeric CHECK (confianca IS NULL OR (confianca >= 0 AND confianca <= 1)),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- INTEGRIDADE EAV: exatamente uma coluna de valor preenchida.
  CONSTRAINT questao_tags_exatamente_um_valor CHECK (
    (CASE WHEN valor_id   IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN valor_bool IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN valor_num  IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  -- não duplicar a MESMA atribuição (questão+dimensão+valor categórico) da MESMA origem.
  -- (valores bool/num podem repetir conceitualmente; o índice cobre o caso categórico)
  CONSTRAINT questao_tags_uniq UNIQUE (questao_id, dimensao_id, valor_id, origem)
);

COMMENT ON TABLE  public.questao_tags IS 'EAV: N dimensões por questão. Exatamente 1 coluna de valor por linha (CHECK). origem rastreia humano|llm|minerado (§8.5).';
COMMENT ON COLUMN public.questao_tags.origem IS 'Procedência da tag: humano (curadoria) | llm (classificador) | minerado (correlação §8.5).';
COMMENT ON COLUMN public.questao_tags.confianca IS 'Confiança do classificador (0..1). Prioriza revisão humana das tags incertas.';

-- =============================================================================
-- 6. DADOS DA USUÁRIA: sessões + respostas + plano diário
--   Todas carregam user_id -> auth.users (D-01, multi-user ready).
-- =============================================================================

-- 6.1 SESSOES — uma rodada de prova/simulado/treino (§8.2)
CREATE TABLE IF NOT EXISTS public.sessoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        public.sessao_tipo NOT NULL DEFAULT 'treino',
  exame_id    uuid REFERENCES public.exames(id) ON DELETE SET NULL,  -- se foi uma edição inteira
  inicio      timestamptz NOT NULL DEFAULT now(),
  fim         timestamptz,                    -- NULL enquanto em andamento
  -- duração em segundos: GENERATED a partir de inicio/fim (consistência garantida).
  duracao_seg integer GENERATED ALWAYS AS (
    CASE WHEN fim IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM (fim - inicio))::int) END
  ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessoes_fim_apos_inicio CHECK (fim IS NULL OR fim >= inicio)
);

COMMENT ON TABLE  public.sessoes IS 'Rodada de estudo (prova_oficial|simulado|treino). Captura respostas; "finalizar" (fim) libera correção (§7).';
COMMENT ON COLUMN public.sessoes.duracao_seg IS 'Duração em segundos, GERADA de (fim - inicio). Garante consistência.';

-- 6.2 RESPOSTAS — o FATO bruto: resposta da usuária vs gabarito (§4, anti-chute)
--   correta: GENERATED? Não — precisaria do gabarito por JOIN; mantemos como
--   coluna persistida preenchida na correção (snapshot do veredito no momento),
--   robusto a futura mudança de gabarito (anulação reclassifica histórico só se quiser).
--   Para single-source-of-truth do acerto, a correção compara resposta_dada com
--   questoes.gabarito e grava aqui. CHECK garante coerência de formato.
CREATE TABLE IF NOT EXISTS public.respostas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id     uuid NOT NULL REFERENCES public.sessoes(id)  ON DELETE CASCADE,
  questao_id    uuid NOT NULL REFERENCES public.questoes(id) ON DELETE CASCADE,
  -- desnormaliza user_id da sessão -> RLS direto + agregação sem JOIN extra.
  -- Mantido consistente por trigger (ver 6.2.1).
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resposta_dada char(1) CHECK (resposta_dada IS NULL OR resposta_dada IN ('A','B','C','D')),
  correta       boolean,                      -- preenchida na correção (NULL = ainda sem gabarito)
  tempo_seg     integer CHECK (tempo_seg IS NULL OR tempo_seg >= 0),
  ts            timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- uma resposta por (sessão, questão).
  CONSTRAINT respostas_sessao_questao_uniq UNIQUE (sessao_id, questao_id)
);

COMMENT ON TABLE  public.respostas IS 'FATO bruto: resposta_dada vs gabarito -> correta. Base de TODO diagnóstico (§4 anti-chute). user_id desnormalizado p/ RLS+agregação.';
COMMENT ON COLUMN public.respostas.correta IS 'Veredito da correção (resposta_dada = questoes.gabarito). NULL até "finalizar" a sessão (§7).';
COMMENT ON COLUMN public.respostas.user_id IS 'Desnormalizado de sessoes.user_id. Mantido por trigger; permite RLS e agregação sem JOIN.';

-- 6.2.1 Trigger: garante respostas.user_id == sessoes.user_id (integridade da desnormalização)
CREATE OR REPLACE FUNCTION public.sync_resposta_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_sessao_user uuid;
BEGIN
  SELECT s.user_id INTO v_sessao_user
  FROM public.sessoes s WHERE s.id = NEW.sessao_id;

  IF v_sessao_user IS NULL THEN
    RAISE EXCEPTION 'sessao_id % inexistente ao inserir resposta', NEW.sessao_id;
  END IF;

  -- força coerência: respostas sempre herdam o dono da sessão.
  NEW.user_id := v_sessao_user;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_resposta_user_id() IS 'Garante respostas.user_id = sessoes.user_id (integridade da coluna desnormalizada).';

-- 6.3 PLANO_DIARIO — saída do planner: quota de questões + distribuição do dia (§8.4)
--   distribuicao_json: estrutura flexível ({materia/subtema/dimensão -> quota}).
--   JSONB porque o formato do plano evolui (planner v1 -> v2) sem migration.
CREATE TABLE IF NOT EXISTS public.plano_diario (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data              date NOT NULL,
  horas             numeric(4,2) CHECK (horas IS NULL OR horas >= 0),  -- horas disponíveis no dia
  questoes_alvo     smallint CHECK (questoes_alvo IS NULL OR questoes_alvo >= 0),
  distribuicao_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  gerado_em         timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- um plano por usuária por dia (re-gerar = UPSERT).
  CONSTRAINT plano_diario_user_data_uniq UNIQUE (user_id, data)
);

COMMENT ON TABLE  public.plano_diario IS 'Saída do planner (§8.4): horas -> questoes_alvo + distribuicao_json (incidência×weakness + repetição espaçada + dose de Ética).';
COMMENT ON COLUMN public.plano_diario.distribuicao_json IS 'JSONB flexível: {nó -> quota}. Formato evolui com o planner sem migration.';

-- =============================================================================
-- 7. ÍNDICES — desenhados pelos access patterns do diagnóstico (§8.3)
--   Agregações-alvo:
--     (a) respostas por questao / por sessao / por usuária
--     (b) questao_tags por dimensao (cross-axis subtema×dimensão)
--     (c) questoes por materia/subtema (taxa por nó de conteúdo)
-- =============================================================================

-- 7.a RESPOSTAS — coração das agregações de diagnóstico
CREATE INDEX IF NOT EXISTS idx_respostas_questao    ON public.respostas (questao_id);
CREATE INDEX IF NOT EXISTS idx_respostas_sessao     ON public.respostas (sessao_id);
CREATE INDEX IF NOT EXISTS idx_respostas_user       ON public.respostas (user_id);
-- taxa por usuária ao longo do tempo (tendência temporal, §8.3) — só corrigidas.
CREATE INDEX IF NOT EXISTS idx_respostas_user_ts    ON public.respostas (user_id, ts)
  WHERE correta IS NOT NULL;
-- join quente questão->resposta filtrando corrigidas (acerto por nó).
CREATE INDEX IF NOT EXISTS idx_respostas_questao_correta
  ON public.respostas (questao_id, correta) WHERE correta IS NOT NULL;

-- 7.b QUESTAO_TAGS — cross-axis (subtema × dimensão) e mineração (§8.5)
CREATE INDEX IF NOT EXISTS idx_questao_tags_dimensao ON public.questao_tags (dimensao_id);
CREATE INDEX IF NOT EXISTS idx_questao_tags_questao  ON public.questao_tags (questao_id);
-- caminho "dada uma dimensão+valor, quais questões" (correlação de erro por valor).
CREATE INDEX IF NOT EXISTS idx_questao_tags_dim_valor
  ON public.questao_tags (dimensao_id, valor_id) WHERE valor_id IS NOT NULL;
-- triagem de revisão humana: tags LLM de baixa confiança primeiro.
CREATE INDEX IF NOT EXISTS idx_questao_tags_revisao
  ON public.questao_tags (origem, confianca) WHERE origem = 'llm';

-- 7.c QUESTOES — taxa por nó de conteúdo + seleção pelo planner/ambiente de teste
CREATE INDEX IF NOT EXISTS idx_questoes_materia  ON public.questoes (materia_id);
CREATE INDEX IF NOT EXISTS idx_questoes_subtema  ON public.questoes (subtema_id);
CREATE INDEX IF NOT EXISTS idx_questoes_micro    ON public.questoes (micro_topico_id);
CREATE INDEX IF NOT EXISTS idx_questoes_exame    ON public.questoes (exame_id);
-- planner/teste filtra por validade (só servir vigentes/válidas) + matéria.
CREATE INDEX IF NOT EXISTS idx_questoes_validade ON public.questoes (validade_status, materia_id);

-- 7.d Hierarquia de conteúdo (navegação e joins)
CREATE INDEX IF NOT EXISTS idx_subtemas_materia      ON public.subtemas (materia_id);
CREATE INDEX IF NOT EXISTS idx_micro_topicos_subtema ON public.micro_topicos (subtema_id);

-- 7.e DADOS DA USUÁRIA
CREATE INDEX IF NOT EXISTS idx_sessoes_user        ON public.sessoes (user_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_user_inicio ON public.sessoes (user_id, inicio DESC);
CREATE INDEX IF NOT EXISTS idx_plano_diario_user   ON public.plano_diario (user_id, data DESC);

-- 7.f DIMENSÃO VALORES
CREATE INDEX IF NOT EXISTS idx_dimensao_valores_dim ON public.dimensao_valores (dimensao_id);

-- =============================================================================
-- 8. TRIGGERS updated_at + integridade
--   Recriados idempotentemente (DROP IF EXISTS -> CREATE).
-- =============================================================================
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'materias','subtemas','micro_topicos','dimensoes','dimensao_valores',
    'exames','questoes','questao_tags','sessoes','respostas','plano_diario'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;

-- trigger de integridade da desnormalização user_id em respostas
DROP TRIGGER IF EXISTS trg_sync_resposta_user_id ON public.respostas;
CREATE TRIGGER trg_sync_resposta_user_id
  BEFORE INSERT OR UPDATE OF sessao_id ON public.respostas
  FOR EACH ROW EXECUTE FUNCTION public.sync_resposta_user_id();

COMMIT;

-- =============================================================================
-- FIM — init_schema. Próximos arquivos:
--   20260621120001_diagnostico_views.sql  (views de diagnóstico + gate de volume)
--   20260621120002_rls_single_user.sql    (RLS Supabase Auth)
-- =============================================================================
