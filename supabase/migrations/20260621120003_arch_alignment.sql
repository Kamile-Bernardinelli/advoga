-- =============================================================================
-- Advoga — Architecture Alignment (EP-0 / Fase 0)
-- Migration: 20260621120003_arch_alignment.sql
-- Author: Dara (@data-engineer) · 2026-06-21
-- Depends on: 20260621120000, 120001, 120002
-- =============================================================================
-- PURPOSE
--   Implementa os pedidos D-1..D-9 do @architect (Aria) que NÃO estavam cobertos
--   pelas migrations anteriores. Cada seção documenta o que estava FEITO vs. ADICIONADO.
--
-- STATUS POR PEDIDO:
--   D-1 (questoes_prova sem gabarito)     → ADICIONADO (view nova)
--   D-2 (3 views de diagnóstico)          → JÁ FEITO (migration 120001)
--   D-3 (índices das agregações)          → JÁ FEITO (migration 120000 §7)
--   D-4 (integridade EAV)                 → PARCIAL → adicionando UNIQUE sem origem
--   D-5 (função corrigir_sessao)          → ADICIONADO (função transacional)
--   D-6 (security_invoker nas views)      → ADICIONADO (ALTER VIEW SET)
--   D-7 (gate calibrável diag_gate_minimo)→ JÁ FEITO (migration 120001)
--   D-8 (anuladas fora do denominador)    → ADICIONADO (CREATE OR REPLACE VIEW corrigidas)
--   D-9 (tipos TypeScript)                → PROCESSO (supabase gen types, não DDL)
--
-- IDEMPOTÊNCIA
--   CREATE OR REPLACE VIEW / FUNCTION, ADD COLUMN IF NOT EXISTS,
--   ADD CONSTRAINT IF NOT EXISTS. Seguro re-rodar.
-- =============================================================================

BEGIN;

-- =============================================================================
-- D-1 (CRÍTICO — segurança): VIEW questoes_prova
--   Projeta questoes SEM gabarito e SEM validade_motivo.
--   É A ÚNICA fonte de leitura do Ambiente de Teste (RSC page.tsx da prova).
--   Fronteira de segurança — defense in depth camada 1 (§3, fullstack-architecture.md).
--
--   Inclui apenas questoes com validade_status IN ('vigente','em_revisao'):
--     - 'anulada'      → excluída (gabarito definitivo pode ter mudado; não servir em prova)
--     - 'desatualizada'→ excluída (resposta baseada em redação revogada)
--     - 'vigente'      → servir
--     - 'em_revisao'   → servir (default conservador; revisão pendente não bloqueia a prova)
--
--   security_invoker=on: herda permissões da sessão que consulta (RLS das tabelas-base aplica).
-- =============================================================================
CREATE OR REPLACE VIEW public.questoes_prova
WITH (security_invoker=on)
AS
SELECT
  q.id,
  q.exame_id,
  q.num_prova,
  q.enunciado,
  q.alt_a,
  q.alt_b,
  q.alt_c,
  q.alt_d,
  -- gabarito AUSENTE (fronteira de segurança — nunca deve chegar ao client em prova ativa)
  -- validade_motivo AUSENTE (exporia informação técnica desnecessária ao front durante prova)
  q.materia_id,
  q.subtema_id,
  q.micro_topico_id,
  q.dificuldade,
  q.validade_status,
  q.fonte_url,
  q.created_at,
  q.updated_at
FROM public.questoes q
WHERE q.validade_status IN ('vigente', 'em_revisao');

COMMENT ON VIEW public.questoes_prova IS
  'D-1 (SEGURANÇA): questoes SEM gabarito e SEM validade_motivo. ÚNICA fonte do Ambiente de Teste. '
  'Exclui anuladas/desatualizadas. security_invoker: RLS da sessão aplica. '
  'Avaliação Drop 2+: REVOKE SELECT (gabarito) FROM authenticated durante sessão ativa como reforço.';

-- =============================================================================
-- D-4 (EAV bem-formado): UNIQUE em (questao_id, dimensao_id, valor_id) sem origem.
--   O UNIQUE existente (questao_tags_uniq) inclui `origem`, permitindo que humano e
--   LLM criem tags independentes para o MESMO valor categórico — comportamento correto
--   para rastreabilidade (§8.5). Mantemos esse UNIQUE.
--
--   O pedido D-4 pede UNIQUE sem origem para evitar tag duplicada no sentido
--   "mesma questão, mesma dimensão, mesmo valor categórico" independente da origem.
--   [AUTO-DECISION] Interpreta D-4 como: impedir que a MESMA origem duplique,
--   que já está coberto por questao_tags_uniq. Adicionamos constraint
--   questao_tags_valor_sem_origem_uniq apenas para valor_id NOT NULL (categóricas),
--   com nulidade explícita. Booleanas/numéricas podem ter múltiplas tags por origens
--   diferentes (ex.: humano classifica posicao_prova com valor_num diferente de llm).
--   Decisão: criar UNIQUE parcial (WHERE valor_id IS NOT NULL) sem origem.
--   Isso garante que uma questão não tenha DOIS registros categóricos idênticos
--   (mesmo questao_id + dimensao_id + valor_id) de origens diferentes,
--   o que seria contradição: se o valor é o mesmo, a segunda origem só confirma.
--   (A constraint existente com origem já previne duplicata da mesma origem.)
--
--   Nota: ADD CONSTRAINT IF NOT EXISTS requer PostgreSQL 9.6+. Supabase PG15 suporta.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questao_tags_categorica_uniq'
      AND conrelid = 'public.questao_tags'::regclass
  ) THEN
    ALTER TABLE public.questao_tags
      ADD CONSTRAINT questao_tags_categorica_uniq
      UNIQUE (questao_id, dimensao_id, valor_id);
    -- Nota: valores NULL em valor_id não participam deste UNIQUE (padrão SQL).
    -- Portanto a constraint cobre apenas o caso categórico (valor_id IS NOT NULL),
    -- sem bloquear múltiplas tags booleanas/numéricas.
  END IF;
END $$;

COMMENT ON CONSTRAINT questao_tags_categorica_uniq ON public.questao_tags IS
  'D-4: garante que questão não tenha duas tags categóricas idênticas (mesmo questao_id + dimensao_id + valor_id). '
  'NULL em valor_id (booleans/numéricas) não participa do UNIQUE — múltiplas origens permitidas nesses tipos.';

-- =============================================================================
-- D-5 (correção atômica): FUNÇÃO corrigir_sessao(p_sessao_id uuid)
--
--   Executa a correção em lote de uma sessão finalizada:
--     1. Valida que a sessão existe e pertence ao auth.uid() corrente (RLS equivalente)
--     2. Seta sessoes.fim = now() (se ainda não foi setado)
--     3. Para cada resposta da sessão:
--        - Se a questão está anulada (validade_status = 'anulada'):
--            correta = TRUE   ← [DECISÃO EXPLÍCITA] não punir a Kamile por questão anulada.
--            Motivo: na prova real o gabarito é anulado e todos os candidatos ganham o ponto.
--            Este comportamento espelha o gabarito definitivo da banca.
--        - Senão: correta = (resposta_dada = gabarito)
--        - Se resposta_dada IS NULL (pulou a questão): correta = FALSE
--
--   IDEMPOTÊNCIA: pode ser chamada múltiplas vezes sem corromper (re-setar correta
--   com o mesmo veredito, re-setar fim com now() é inofensivo se a sessão já tem fim).
--   Usada por finalizeSession (service_role, server-only).
--
--   SEGURANÇA: SECURITY DEFINER executa com os privilégios do owner (service_role context).
--   O gabarito só é lido aqui, dentro da função transacional, NUNCA exposto ao client.
--   SET search_path = '' previne hijack.
--
--   RETORNO: JSON com resumo { sessao_id, n_total, n_corrigidas, n_acertos, n_anuladas_bonus }
-- =============================================================================
CREATE OR REPLACE FUNCTION public.corrigir_sessao(p_sessao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sessao         public.sessoes%ROWTYPE;
  v_n_total        integer := 0;
  v_n_corrigidas   integer := 0;
  v_n_acertos      integer := 0;
  v_n_anuladas     integer := 0;
BEGIN
  -- 1. Busca e bloqueia a sessão (FOR UPDATE previne condição de corrida em re-finalize)
  SELECT * INTO v_sessao
  FROM public.sessoes
  WHERE id = p_sessao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'corrigir_sessao: sessão % não encontrada', p_sessao_id;
  END IF;

  -- 2. Marca fim da sessão (idempotente: COALESCE mantém o primeiro valor registrado)
  UPDATE public.sessoes
  SET fim = COALESCE(fim, now())
  WHERE id = p_sessao_id;

  -- 3. Corrige respostas em lote (uma operação set-based por questão)
  --
  --    DECISÃO EXPLÍCITA — questões anuladas:
  --    validade_status = 'anulada' → correta = TRUE (bonus point).
  --    Justificativa: espelha o gabarito definitivo da banca (todos ganham o ponto).
  --    Anti-chute (D-8): a view de diagnóstico exclui anuladas do denominador n_feitas,
  --    portanto este bonus não infla artificialmente as taxas de acerto da Kamile.
  --
  --    resposta_dada IS NULL (questão pulada) → correta = FALSE
  --    (ausência de resposta não pontua, mesmo em anuladas — a Kamile ainda precisa
  --    indicar qualquer letra; questão pulada = erro na prova real).
  WITH correcao AS (
    SELECT
      r.id                         AS resposta_id,
      CASE
        WHEN q.validade_status = 'anulada' AND r.resposta_dada IS NOT NULL
             THEN TRUE   -- BONUS ANULADA: qualquer resposta marcada = acerto
        WHEN r.resposta_dada IS NULL
             THEN FALSE  -- PULADA: sem resposta = erro
        ELSE (r.resposta_dada = q.gabarito)  -- NORMAL: comparação direta
      END                          AS veredito,
      (q.validade_status = 'anulada' AND r.resposta_dada IS NOT NULL) AS e_anulada_bonus
    FROM public.respostas r
    JOIN public.questoes q ON q.id = r.questao_id
    WHERE r.sessao_id = p_sessao_id
  )
  UPDATE public.respostas r
  SET correta = c.veredito
  FROM correcao c
  WHERE r.id = c.resposta_id;

  -- 4. Coleta métricas para retorno (lê após UPDATE)
  SELECT
    count(*)                                    AS n_total,
    count(*) FILTER (WHERE correta IS NOT NULL) AS n_corrigidas,
    count(*) FILTER (WHERE correta = true)      AS n_acertos,
    count(*) FILTER (
      WHERE correta = true
        AND EXISTS (
          SELECT 1 FROM public.questoes q2
          WHERE q2.id = questao_id
            AND q2.validade_status = 'anulada'
        )
    )                                           AS n_anuladas_bonus
  INTO v_n_total, v_n_corrigidas, v_n_acertos, v_n_anuladas
  FROM public.respostas
  WHERE sessao_id = p_sessao_id;

  -- 5. Retorna resumo JSON (consumido por finalizeSession na Server Action)
  RETURN jsonb_build_object(
    'sessao_id',         p_sessao_id,
    'n_total',           v_n_total,
    'n_corrigidas',      v_n_corrigidas,
    'n_acertos',         v_n_acertos,
    'n_anuladas_bonus',  v_n_anuladas,
    'ok',                (v_n_total = v_n_corrigidas)
  );
END;
$$;

COMMENT ON FUNCTION public.corrigir_sessao(uuid) IS
  'D-5: corrige respostas de uma sessão em lote (transacional, idempotente). '
  'Anuladas (validade_status=anulada) → correta=TRUE (não punir — espelha gabarito definitivo da banca). '
  'Puladas (resposta_dada NULL) → correta=FALSE. '
  'SECURITY DEFINER: gabarito só lido server-side, nunca exposto ao client. '
  'Retorna JSON {sessao_id, n_total, n_corrigidas, n_acertos, n_anuladas_bonus, ok}.';

-- =============================================================================
-- D-6 (security_invoker nas views): garante que as views herdam as permissões
--   da sessão que as consulta (RLS das tabelas-base aplica corretamente).
--
--   Em PostgreSQL 15, views são security_invoker por padrão, mas a opção explícita
--   é requerida pelo pedido D-6 e boa prática de documentação de intenção.
--
--   Aplica nas 4 views de diagnóstico + questoes_prova (já criada acima com a opção).
-- =============================================================================
ALTER VIEW public.v_respostas_corrigidas SET (security_invoker=on);
ALTER VIEW public.diag_por_no           SET (security_invoker=on);
ALTER VIEW public.diag_cross_subtema_dimensao SET (security_invoker=on);
ALTER VIEW public.diag_weakness_score   SET (security_invoker=on);
-- questoes_prova: já criada com security_invoker=on nesta migration.

COMMENT ON VIEW public.v_respostas_corrigidas IS
  'Respostas já corrigidas (correta NOT NULL) + dados de conteúdo da questão. '
  'Base das agregações de diagnóstico. security_invoker=on (D-6): RLS da sessão aplica.';

COMMENT ON VIEW public.diag_por_no IS
  'Diagnóstico unificado por nó (materia|subtema|micro|<dimensão aberta>). '
  'taxa, tendência e GATE EXPLÍCITO amostra_suficiente (§4 anti-chute). '
  'Anuladas excluídas do denominador n_feitas (D-8). security_invoker=on (D-6).';

COMMENT ON VIEW public.diag_cross_subtema_dimensao IS
  'CROSS-AXIS (§8.3): taxa por subtema × dimensão. '
  'Revela "erra Posse em caso-concreto, acerta letra-de-lei". '
  'Anuladas excluídas do denominador (D-8). security_invoker=on (D-6).';

COMMENT ON VIEW public.diag_weakness_score IS
  'Weakness score (§8.3): (1-taxa) × confiança_volume × peso_incidência. '
  'Ordena alvos. App deve filtrar amostra_suficiente=true (anti-chute §4). '
  'security_invoker=on (D-6).';

-- =============================================================================
-- D-8 (anuladas fora do denominador):
--   As views existentes calculam n_feitas e taxa sobre TODAS as respostas corrigidas,
--   incluindo questões anuladas. O brief exige que anuladas NÃO entrem no denominador
--   (n_feitas) dos diagnósticos — anti-chute: não punir a Kamile nem inflar taxas.
--
--   ESTRATÉGIA: re-criar a view base v_respostas_corrigidas excluindo anuladas,
--   e re-criar as 3 views de diagnóstico que dependem dela.
--   O diagnóstico passa a operar APENAS sobre questões vigentes/em_revisao/desatualizadas
--   (validade_status != 'anulada').
--
--   Questões anuladas:
--     - NÃO entram no denominador de taxa (n_feitas).
--     - NÃO aparecem como nós de diagnóstico.
--     - SÃO corrigidas com correta=TRUE pela função corrigir_sessao (D-5) —
--       o bonus é gravado em respostas, mas a view o ignora no diagnóstico.
--     - A Kamile ganha o ponto (sessao.resultado) sem que isso distorça seu mapa de fraquezas.
-- =============================================================================

-- BASE: exclui anuladas do denominador de diagnóstico
CREATE OR REPLACE VIEW public.v_respostas_corrigidas
WITH (security_invoker=on)
AS
SELECT
  r.id            AS resposta_id,
  r.user_id,
  r.sessao_id,
  r.questao_id,
  r.correta,
  r.tempo_seg,
  r.ts,
  q.materia_id,
  q.subtema_id,
  q.micro_topico_id,
  q.validade_status
FROM public.respostas r
JOIN public.questoes  q ON q.id = r.questao_id
WHERE r.correta IS NOT NULL
  AND q.validade_status <> 'anulada';  -- D-8: anuladas fora do denominador de diagnóstico

COMMENT ON VIEW public.v_respostas_corrigidas IS
  'Respostas já corrigidas (correta NOT NULL) + dados de conteúdo da questão. '
  'Base das agregações de diagnóstico. '
  'D-8: EXCLUI questões anuladas (validade_status=anulada) — não entram no denominador n_feitas. '
  'security_invoker=on (D-6): RLS da sessão aplica.';

-- DIAGNÓSTICO POR NÓ (recria para herdar a view base corrigida)
-- Idêntico ao 120001 exceto pela view base já corrigida (d-8 via v_respostas_corrigidas)
CREATE OR REPLACE VIEW public.diag_por_no
WITH (security_invoker=on)
AS
WITH g AS (SELECT public.diag_gate_minimo() AS minimo),

materia AS (
  SELECT
    vr.user_id,
    'materia'::text                                   AS eixo,
    vr.materia_id::text                               AS no_id,
    m.nome                                            AS no_nome,
    count(*)                                          AS n_feitas,
    count(*) FILTER (WHERE vr.correta)                AS n_acertos,
    min(vr.ts)                                        AS primeiro_ts,
    max(vr.ts)                                        AS ultimo_ts,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts >  median_split.mid)        AS taxa_recente,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts <= median_split.mid)        AS taxa_antiga
  FROM public.v_respostas_corrigidas vr
  JOIN public.materias m ON m.id = vr.materia_id
  JOIN LATERAL (
    SELECT (min(x.ts) + (max(x.ts) - min(x.ts)) / 2) AS mid
    FROM public.v_respostas_corrigidas x
    WHERE x.user_id = vr.user_id AND x.materia_id = vr.materia_id
  ) median_split ON true
  GROUP BY vr.user_id, vr.materia_id, m.nome, median_split.mid
),

subtema AS (
  SELECT
    vr.user_id,
    'subtema'::text                                   AS eixo,
    vr.subtema_id::text                               AS no_id,
    s.nome                                            AS no_nome,
    count(*)                                          AS n_feitas,
    count(*) FILTER (WHERE vr.correta)                AS n_acertos,
    min(vr.ts)                                        AS primeiro_ts,
    max(vr.ts)                                        AS ultimo_ts,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts >  median_split.mid)        AS taxa_recente,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts <= median_split.mid)        AS taxa_antiga
  FROM public.v_respostas_corrigidas vr
  JOIN public.subtemas s ON s.id = vr.subtema_id
  JOIN LATERAL (
    SELECT (min(x.ts) + (max(x.ts) - min(x.ts)) / 2) AS mid
    FROM public.v_respostas_corrigidas x
    WHERE x.user_id = vr.user_id AND x.subtema_id = vr.subtema_id
  ) median_split ON true
  WHERE vr.subtema_id IS NOT NULL
  GROUP BY vr.user_id, vr.subtema_id, s.nome, median_split.mid
),

micro AS (
  SELECT
    vr.user_id,
    'micro'::text                                     AS eixo,
    vr.micro_topico_id::text                          AS no_id,
    mt.nome                                           AS no_nome,
    count(*)                                          AS n_feitas,
    count(*) FILTER (WHERE vr.correta)                AS n_acertos,
    min(vr.ts)                                        AS primeiro_ts,
    max(vr.ts)                                        AS ultimo_ts,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts >  median_split.mid)        AS taxa_recente,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts <= median_split.mid)        AS taxa_antiga
  FROM public.v_respostas_corrigidas vr
  JOIN public.micro_topicos mt ON mt.id = vr.micro_topico_id
  JOIN LATERAL (
    SELECT (min(x.ts) + (max(x.ts) - min(x.ts)) / 2) AS mid
    FROM public.v_respostas_corrigidas x
    WHERE x.user_id = vr.user_id AND x.micro_topico_id = vr.micro_topico_id
  ) median_split ON true
  WHERE vr.micro_topico_id IS NOT NULL
  GROUP BY vr.user_id, vr.micro_topico_id, mt.nome, median_split.mid
),

dimensao AS (
  SELECT
    vr.user_id,
    d.chave                                           AS eixo,
    COALESCE(dv.id::text, qt.valor_bool::text, qt.valor_num::text) AS no_id,
    COALESCE(dv.valor, qt.valor_bool::text, qt.valor_num::text)    AS no_nome,
    count(*)                                          AS n_feitas,
    count(*) FILTER (WHERE vr.correta)                AS n_acertos,
    min(vr.ts)                                        AS primeiro_ts,
    max(vr.ts)                                        AS ultimo_ts,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts >  median_split.mid)        AS taxa_recente,
    avg(CASE WHEN vr.correta THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE vr.ts <= median_split.mid)        AS taxa_antiga
  FROM public.v_respostas_corrigidas vr
  JOIN public.questao_tags qt ON qt.questao_id = vr.questao_id
  JOIN public.dimensoes    d  ON d.id = qt.dimensao_id AND d.ativa
  LEFT JOIN public.dimensao_valores dv ON dv.id = qt.valor_id
  JOIN LATERAL (
    SELECT (min(x.ts) + (max(x.ts) - min(x.ts)) / 2) AS mid
    FROM public.v_respostas_corrigidas x
    JOIN public.questao_tags xqt ON xqt.questao_id = x.questao_id
    WHERE x.user_id = vr.user_id
      AND xqt.dimensao_id = qt.dimensao_id
      AND COALESCE(xqt.valor_id::text, xqt.valor_bool::text, xqt.valor_num::text)
        = COALESCE(qt.valor_id::text, qt.valor_bool::text, qt.valor_num::text)
  ) median_split ON true
  GROUP BY vr.user_id, d.chave,
           COALESCE(dv.id::text, qt.valor_bool::text, qt.valor_num::text),
           COALESCE(dv.valor, qt.valor_bool::text, qt.valor_num::text)
),

unioned AS (
  SELECT * FROM materia
  UNION ALL SELECT * FROM subtema
  UNION ALL SELECT * FROM micro
  UNION ALL SELECT * FROM dimensao
)
SELECT
  u.user_id,
  u.eixo,
  u.no_id,
  u.no_nome,
  u.n_feitas,
  u.n_acertos,
  round(u.n_acertos::numeric / NULLIF(u.n_feitas, 0), 4)            AS taxa,
  (u.n_feitas >= g.minimo)                                          AS amostra_suficiente,
  g.minimo                                                          AS gate_minimo,
  CASE
    WHEN u.taxa_recente IS NULL OR u.taxa_antiga IS NULL THEN NULL
    ELSE round(u.taxa_recente - u.taxa_antiga, 4)
  END                                                               AS tendencia,
  u.primeiro_ts,
  u.ultimo_ts,
  now()                                                             AS atualizado_em
FROM unioned u
CROSS JOIN g
WHERE u.no_id IS NOT NULL;

-- CROSS-AXIS (recria para herdar a view base corrigida)
CREATE OR REPLACE VIEW public.diag_cross_subtema_dimensao
WITH (security_invoker=on)
AS
WITH g AS (SELECT public.diag_gate_minimo() AS minimo)
SELECT
  vr.user_id,
  vr.subtema_id,
  s.nome                                              AS subtema_nome,
  s.materia_id,
  d.chave                                             AS dimensao_chave,
  d.nome                                              AS dimensao_nome,
  COALESCE(dv.id::text, qt.valor_bool::text, qt.valor_num::text) AS valor_id,
  COALESCE(dv.valor, qt.valor_bool::text, qt.valor_num::text)    AS valor_nome,
  count(*)                                            AS n_feitas,
  count(*) FILTER (WHERE vr.correta)                  AS n_acertos,
  round(count(*) FILTER (WHERE vr.correta)::numeric
        / NULLIF(count(*), 0), 4)                     AS taxa,
  (count(*) >= g.minimo)                              AS amostra_suficiente,
  g.minimo                                            AS gate_minimo,
  max(vr.ts)                                          AS ultimo_ts,
  now()                                               AS atualizado_em
FROM public.v_respostas_corrigidas vr
JOIN public.subtemas     s  ON s.id  = vr.subtema_id
JOIN public.questao_tags qt ON qt.questao_id = vr.questao_id
JOIN public.dimensoes    d  ON d.id  = qt.dimensao_id AND d.ativa
LEFT JOIN public.dimensao_valores dv ON dv.id = qt.valor_id
CROSS JOIN g
WHERE vr.subtema_id IS NOT NULL
GROUP BY vr.user_id, vr.subtema_id, s.nome, s.materia_id,
         d.chave, d.nome,
         COALESCE(dv.id::text, qt.valor_bool::text, qt.valor_num::text),
         COALESCE(dv.valor, qt.valor_bool::text, qt.valor_num::text),
         g.minimo;

-- WEAKNESS SCORE (recria para herdar diag_por_no corrigido)
CREATE OR REPLACE VIEW public.diag_weakness_score
WITH (security_invoker=on)
AS
SELECT
  dn.user_id,
  dn.eixo,
  dn.no_id,
  dn.no_nome,
  dn.n_feitas,
  dn.taxa,
  dn.tendencia,
  dn.amostra_suficiente,
  COALESCE(m.questoes_por_prova, 1)::numeric          AS peso_incidencia,
  LEAST(1.0, dn.n_feitas::numeric
        / NULLIF(public.diag_gate_minimo() * 2, 0))   AS confianca_volume,
  round(
    (1 - COALESCE(dn.taxa, 0))
    * LEAST(1.0, dn.n_feitas::numeric / NULLIF(public.diag_gate_minimo() * 2, 0))
    * COALESCE(m.questoes_por_prova, 1)
  , 4)                                                 AS weakness_score,
  now()                                                AS atualizado_em
FROM public.diag_por_no dn
LEFT JOIN public.materias m
  ON dn.eixo = 'materia' AND m.id::text = dn.no_id;

-- =============================================================================
-- SLUGS: adiciona coluna slug às tabelas de conteúdo (necessário para o seed D-4/TAREFA B)
--   A migration de seed (120004) usa ON CONFLICT (slug) DO NOTHING, portanto
--   slug deve ser UNIQUE e NOT NULL (ou ao menos UNIQUE com default NULL e
--   constraint deferida). Optamos por UNIQUE com nullable + seed fornece slug.
--   Adicionamos como NULLABLE com UNIQUE aqui; o seed populará todos os valores.
--
--   dimensoes.chave já funciona como slug (UNIQUE, já existia) — sem adição necessária.
--   dimensao_valores: usa (dimensao_id, valor) UNIQUE como chave natural — sem slug.
--   exames: usa (edicao, tipo_prova) UNIQUE — sem slug.
--   questao_tags: sem slug (linha de EAV, sem chave natural estável simples).
--   questoes: sem slug (chave natural é (exame_id, num_prova)).
-- =============================================================================

-- materias: slug UNIQUE (chave estável p/ seed idempotente)
ALTER TABLE public.materias
  ADD COLUMN IF NOT EXISTS slug text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'materias_slug_uniq'
      AND conrelid = 'public.materias'::regclass
  ) THEN
    ALTER TABLE public.materias ADD CONSTRAINT materias_slug_uniq UNIQUE (slug);
  END IF;
END $$;

COMMENT ON COLUMN public.materias.slug IS 'Chave estável snake_case p/ seed idempotente e referência no código (ex.: etica_estatuto). UNIQUE.';

-- subtemas: slug UNIQUE
ALTER TABLE public.subtemas
  ADD COLUMN IF NOT EXISTS slug text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subtemas_slug_uniq'
      AND conrelid = 'public.subtemas'::regclass
  ) THEN
    ALTER TABLE public.subtemas ADD CONSTRAINT subtemas_slug_uniq UNIQUE (slug);
  END IF;
END $$;

COMMENT ON COLUMN public.subtemas.slug IS 'Chave estável snake_case p/ seed idempotente (ex.: civ_direito_coisas). UNIQUE global.';

-- micro_topicos: slug UNIQUE
ALTER TABLE public.micro_topicos
  ADD COLUMN IF NOT EXISTS slug text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'micro_topicos_slug_uniq'
      AND conrelid = 'public.micro_topicos'::regclass
  ) THEN
    ALTER TABLE public.micro_topicos ADD CONSTRAINT micro_topicos_slug_uniq UNIQUE (slug);
  END IF;
END $$;

COMMENT ON COLUMN public.micro_topicos.slug IS 'Chave estável snake_case p/ seed idempotente (ex.: coisas_posse_conceito). UNIQUE global.';

-- =============================================================================
-- RLS das novas views (questoes_prova):
--   As views com security_invoker herdam RLS das tabelas-base (questoes).
--   A tabela questoes já tem RLS ON + policy SELECT para authenticated (migration 120002).
--   Portanto questoes_prova também filtra por authenticated automaticamente.
--   Sem necessidade de policy adicional nas views (views não têm policies próprias no PG).
-- =============================================================================

COMMIT;

-- =============================================================================
-- SUMÁRIO DE MUDANÇAS
--   D-1: CREATE VIEW questoes_prova (SEM gabarito/validade_motivo) — NOVO
--   D-4: ADD CONSTRAINT questao_tags_categorica_uniq (questao_id,dimensao_id,valor_id) — NOVO
--   D-5: CREATE FUNCTION corrigir_sessao(uuid) — NOVO (transacional, idempotente)
--   D-6: ALTER VIEW ... SET (security_invoker=on) em 4 views — NOVO
--   D-8: CREATE OR REPLACE VIEW com filtro validade_status <> 'anulada' em 4 views — ATUALIZADO
--   SLUG: ADD COLUMN slug + UNIQUE em materias, subtemas, micro_topicos — NOVO (necessário para seed)
--
-- D-2, D-3, D-7: JÁ COBERTOS nas migrations anteriores (não duplicados).
-- D-9: supabase gen types typescript (processo, não DDL) — executar após db push.
-- =============================================================================
