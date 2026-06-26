/**
 * apply-tags.mjs
 * Idempotente: aplica tags do workflow de classificacao do 42 EOU ao banco local.
 *
 * O que faz:
 *  1. UPDATE questoes: materia_id + subtema_id via slug
 *  2. INSERT questao_tags: estilo_cognitivo (categorica, valor_id)
 *                          dimensoes[] boolenas (valor_bool=true)
 *
 * Conexao: postgresql://postgres:postgres@127.0.0.1:54322/postgres
 * Exame  : edicao=42 (UUID resolvido em runtime)
 */

import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;

// ── 1. Dados do workflow ──────────────────────────────────────────────────────

const TAGS = [
  { num: 1, materia_slug: "etica_estatuto", subtema_slug: "etica_direitos_prerrogativas", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 2, materia_slug: "etica_estatuto", subtema_slug: "etica_deveres_sigilo", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 3, materia_slug: "etica_estatuto", subtema_slug: "etica_incompatibilidades_impedimentos", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 4, materia_slug: "etica_estatuto", subtema_slug: "etica_deveres_sigilo", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 5, materia_slug: "etica_estatuto", subtema_slug: "etica_incompatibilidades_impedimentos", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 6, materia_slug: "etica_estatuto", subtema_slug: "etica_oab_institucional", estilo_cognitivo: "caso_concreto", dimensoes: ["prazo_numerico"] },
  { num: 7, materia_slug: "etica_estatuto", subtema_slug: "etica_honorarios", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 8, materia_slug: "etica_estatuto", subtema_slug: "etica_direitos_prerrogativas", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 9, materia_slug: "filosofia_direito", subtema_slug: "fil_justica", estilo_cognitivo: "doutrina", dimensoes: [] },
  { num: 10, materia_slug: "filosofia_direito", subtema_slug: "fil_justica", estilo_cognitivo: "doutrina", dimensoes: [] },
  { num: 11, materia_slug: "direito_constitucional", subtema_slug: "const_poder_legislativo", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 12, materia_slug: "direito_constitucional", subtema_slug: "const_poder_judiciario", estilo_cognitivo: "jurisprudencia_sumula", dimensoes: ["dependencia_sumula", "enunciado_longo"] },
  { num: 13, materia_slug: "direito_constitucional", subtema_slug: "const_organizacao_estado", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 14, materia_slug: "direito_constitucional", subtema_slug: "const_defesa_estado", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 15, materia_slug: "direito_constitucional", subtema_slug: "const_poder_legislativo", estilo_cognitivo: "letra_de_lei", dimensoes: ["prazo_numerico"] },
  { num: 16, materia_slug: "direito_constitucional", subtema_slug: "const_direitos_garantias", estilo_cognitivo: "jurisprudencia_sumula", dimensoes: ["dependencia_sumula"] },
  { num: 17, materia_slug: "direitos_humanos", subtema_slug: "dh_grupos_vulneraveis", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 18, materia_slug: "direito_internacional", subtema_slug: "int_publico_geral", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 19, materia_slug: "direito_eleitoral", subtema_slug: "ele_propaganda", estilo_cognitivo: "letra_de_lei", dimensoes: ["prazo_numerico"] },
  { num: 20, materia_slug: "direito_eleitoral", subtema_slug: "ele_direitos_politicos", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 21, materia_slug: "direito_internacional", subtema_slug: "int_publico_geral", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "prazo_numerico"] },
  { num: 22, materia_slug: "direito_internacional", subtema_slug: "int_publico_geral", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 23, materia_slug: "direito_financeiro", subtema_slug: "fin_lrf", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 24, materia_slug: "direito_financeiro", subtema_slug: "fin_lrf", estilo_cognitivo: "letra_de_lei", dimensoes: ["prazo_numerico"] },
  { num: 25, materia_slug: "direito_tributario", subtema_slug: "trib_processo_tributario", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 26, materia_slug: "direito_tributario", subtema_slug: "trib_credito_tributario", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 27, materia_slug: "direito_tributario", subtema_slug: "trib_credito_tributario", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "prazo_numerico"] },
  { num: 28, materia_slug: "direito_tributario", subtema_slug: "trib_obrigacao_tributaria", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 29, materia_slug: "direito_tributario", subtema_slug: "trib_limitacoes_poder_tributar", estilo_cognitivo: "caso_concreto", dimensoes: ["prazo_numerico"] },
  { num: 30, materia_slug: "direito_administrativo", subtema_slug: "adm_bens_publicos", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 31, materia_slug: "direito_administrativo", subtema_slug: "adm_atos_administrativos", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 32, materia_slug: "direito_administrativo", subtema_slug: "adm_agentes_publicos", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "prazo_numerico"] },
  { num: 33, materia_slug: "direito_administrativo", subtema_slug: "adm_contratos_administrativos", estilo_cognitivo: "letra_de_lei", dimensoes: ["prazo_numerico"] },
  { num: 34, materia_slug: "direito_administrativo", subtema_slug: "adm_contratos_administrativos", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 35, materia_slug: "direito_ambiental", subtema_slug: "amb_codigo_florestal", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 36, materia_slug: "direito_ambiental", subtema_slug: "amb_responsabilidade_ambiental", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 37, materia_slug: "direito_civil", subtema_slug: "civ_responsabilidade_civil", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 38, materia_slug: "direito_civil", subtema_slug: "civ_contratos_especie", estilo_cognitivo: "caso_concreto", dimensoes: ["prazo_numerico"] },
  { num: 39, materia_slug: "direito_civil", subtema_slug: "civ_familia", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "dependencia_sumula"] },
  { num: 40, materia_slug: "direito_civil", subtema_slug: "civ_obrigacoes", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 41, materia_slug: "direito_civil", subtema_slug: "civ_sucessoes", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 42, materia_slug: "direito_civil", subtema_slug: "civ_direito_coisas", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "prazo_numerico"] },
  { num: 43, materia_slug: "eca", subtema_slug: "eca_principios_direitos", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 44, materia_slug: "eca", subtema_slug: "eca_principios_direitos", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 45, materia_slug: "direito_consumidor", subtema_slug: "cdc_responsabilidade", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 46, materia_slug: "direito_consumidor", subtema_slug: "cdc_direitos_basicos", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 47, materia_slug: "direito_empresarial", subtema_slug: "emp_teoria_empresa", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 48, materia_slug: "direito_empresarial", subtema_slug: "emp_sociedades_geral", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 49, materia_slug: "direito_empresarial", subtema_slug: "emp_propriedade_industrial", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 50, materia_slug: "direito_empresarial", subtema_slug: "emp_falencia_recuperacao", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "prazo_numerico"] },
  { num: 51, materia_slug: "processo_civil", subtema_slug: "pc_processo_conhecimento", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 52, materia_slug: "processo_civil", subtema_slug: "pc_provas", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 53, materia_slug: "processo_civil", subtema_slug: "pc_cumprimento_sentenca", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 54, materia_slug: "processo_civil", subtema_slug: "pc_sentenca_coisa_julgada", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 55, materia_slug: "processo_civil", subtema_slug: "pc_cumprimento_sentenca", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 56, materia_slug: "processo_civil", subtema_slug: "pc_partes_litisconsorcio", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 57, materia_slug: "direito_penal", subtema_slug: "pen_aplicacao_lei_penal", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 58, materia_slug: "direito_penal", subtema_slug: "pen_crimes_contra_dignidade_sexual", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 59, materia_slug: "direito_penal", subtema_slug: "pen_excludentes", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 60, materia_slug: "direito_penal", subtema_slug: "pen_teoria_crime", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 61, materia_slug: "direito_penal", subtema_slug: "pen_concurso_pessoas", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 62, materia_slug: "direito_penal", subtema_slug: "pen_aplicacao_lei_penal", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "prazo_numerico"] },
  { num: 63, materia_slug: "processo_penal", subtema_slug: "pp_recursos_penais", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 64, materia_slug: "processo_penal", subtema_slug: "pp_prisao_medidas_cautelares", estilo_cognitivo: "caso_concreto", dimensoes: ["dependencia_sumula"] },
  { num: 65, materia_slug: "processo_penal", subtema_slug: "pp_acoes_autonomas", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 66, materia_slug: "processo_penal", subtema_slug: "pp_procedimentos", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 67, materia_slug: "processo_penal", subtema_slug: "pp_provas_penais", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 68, materia_slug: "processo_penal", subtema_slug: "pp_acoes_autonomas", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 69, materia_slug: "direito_previdenciario", subtema_slug: "prev_segurados_dependentes", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 70, materia_slug: "direito_previdenciario", subtema_slug: "prev_beneficios", estilo_cognitivo: "letra_de_lei", dimensoes: [] },
  { num: 71, materia_slug: "direito_trabalho", subtema_slug: "trab_remuneracao_salario", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "prazo_numerico"] },
  { num: 72, materia_slug: "direito_trabalho", subtema_slug: "trab_relacao_emprego", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 73, materia_slug: "processo_trabalho", subtema_slug: "pt_nulidades_prescricao", estilo_cognitivo: "caso_concreto", dimensoes: ["dependencia_sumula"] },
  { num: 74, materia_slug: "direito_trabalho", subtema_slug: "trab_ferias_repouso", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 75, materia_slug: "direito_trabalho", subtema_slug: "trab_jornada", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo"] },
  { num: 76, materia_slug: "processo_trabalho", subtema_slug: "pt_recursos_trab", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "dependencia_sumula"] },
  { num: 77, materia_slug: "processo_trabalho", subtema_slug: "pt_provas_trab", estilo_cognitivo: "jurisprudencia_sumula", dimensoes: ["dependencia_sumula"] },
  { num: 78, materia_slug: "processo_trabalho", subtema_slug: "pt_acoes_especiais_trab", estilo_cognitivo: "caso_concreto", dimensoes: [] },
  { num: 79, materia_slug: "processo_trabalho", subtema_slug: "pt_execucao_trab", estilo_cognitivo: "caso_concreto", dimensoes: ["enunciado_longo", "dependencia_sumula"] },
  { num: 80, materia_slug: "processo_trabalho", subtema_slug: "pt_principios", estilo_cognitivo: "letra_de_lei", dimensoes: ["prazo_numerico"] },
];

// ── 2. Helpers ────────────────────────────────────────────────────────────────

/**
 * Normaliza o valor de estilo_cognitivo do JSON (usa underscore ou hifen de
 * forma inconsistente) para o formato exato armazenado em dimensao_valores
 * (sempre com hifen).
 */
function normalizeEstiloSlug(raw) {
  // substitui underscores por hifens
  return raw.replace(/_/g, '-');
}

// ── 3. Main ───────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function main() {
  const client = await pool.connect();

  try {
    // ── 3.1 Resolver exame_id ──────────────────────────────────────────────
    const exameRes = await client.query(
      `SELECT id FROM exames WHERE edicao = $1 LIMIT 1`,
      [42]
    );
    if (exameRes.rows.length === 0) {
      throw new Error('Exame edicao=42 nao encontrado no banco.');
    }
    const exameId = exameRes.rows[0].id;
    console.log(`Exame 42 UUID: ${exameId}`);

    // ── 3.2 Carregar lookup tables em memória ──────────────────────────────
    const materiasRes = await client.query(`SELECT id, slug FROM materias`);
    const materiaMap = Object.fromEntries(materiasRes.rows.map(r => [r.slug, r.id]));

    const subtemasRes = await client.query(`SELECT id, slug FROM subtemas`);
    const subtemaMap = Object.fromEntries(subtemasRes.rows.map(r => [r.slug, r.id]));

    const dimensoesRes = await client.query(`SELECT id, chave FROM dimensoes`);
    const dimensaoMap = Object.fromEntries(dimensoesRes.rows.map(r => [r.chave, r.id]));

    // dimensao_valores: chave composta (dimensao_chave, valor) -> id
    const dvRes = await client.query(`
      SELECT dv.id, d.chave AS dim_chave, dv.valor
      FROM dimensao_valores dv
      JOIN dimensoes d ON d.id = dv.dimensao_id
    `);
    // Map: "dim_chave|valor" -> uuid
    const dvMap = Object.fromEntries(dvRes.rows.map(r => [`${r.dim_chave}|${r.valor}`, r.id]));

    // ── 3.3 STEP 1: UPDATE questoes (materia_id + subtema_id) ──────────────
    console.log('\n=== STEP 1: UPDATE questoes ===');
    let materiaOk = 0, materiaFail = 0;
    let subtemaOk = 0, subtemaFail = 0;
    const materiaNotFound = [];
    const subtemaNotFound = [];

    for (const tag of TAGS) {
      const materiaId = materiaMap[tag.materia_slug] ?? null;
      const subtemaId = subtemaMap[tag.subtema_slug] ?? null;

      if (!materiaId) {
        materiaFail++;
        materiaNotFound.push({ num: tag.num, slug: tag.materia_slug });
      } else {
        materiaOk++;
      }

      if (!subtemaId) {
        subtemaFail++;
        subtemaNotFound.push({ num: tag.num, slug: tag.subtema_slug });
      } else {
        subtemaOk++;
      }

      // Atualiza mesmo que um dos dois seja null — registra o que foi resolvido
      const updateRes = await client.query(`
        UPDATE questoes
        SET
          materia_id = $1,
          subtema_id = $2,
          updated_at = now()
        WHERE exame_id = $3 AND num_prova = $4
      `, [materiaId, subtemaId, exameId, tag.num]);

      if (updateRes.rowCount === 0) {
        console.warn(`  WARN: questao num_prova=${tag.num} nao encontrada no banco.`);
      }
    }

    console.log(`  materias  : ${materiaOk} resolvidas, ${materiaFail} nao encontradas`);
    console.log(`  subtemas  : ${subtemaOk} resolvidos, ${subtemaFail} nao encontrados`);
    if (materiaNotFound.length > 0) {
      console.log('  MATERIAS NAO ENCONTRADAS:');
      materiaNotFound.forEach(x => console.log(`    Q${x.num}: "${x.slug}"`));
    }
    if (subtemaNotFound.length > 0) {
      console.log('  SUBTEMAS NAO ENCONTRADOS:');
      subtemaNotFound.forEach(x => console.log(`    Q${x.num}: "${x.slug}"`));
    }

    // ── 3.4 STEP 2: INSERT questao_tags (idempotente via ON CONFLICT DO NOTHING) ─

    console.log('\n=== STEP 2: INSERT questao_tags ===');

    const estiloDimId = dimensaoMap['estilo_cognitivo'];
    if (!estiloDimId) throw new Error('Dimensao estilo_cognitivo nao encontrada em dimensoes.');

    let tagsInserted = 0;
    let tagsSkipped = 0;
    let tagsError = 0;

    for (const tag of TAGS) {
      // Resolver questao_id
      const qRes = await client.query(
        `SELECT id FROM questoes WHERE exame_id = $1 AND num_prova = $2 LIMIT 1`,
        [exameId, tag.num]
      );
      if (qRes.rows.length === 0) {
        console.warn(`  WARN: questao num_prova=${tag.num} nao encontrada — pulando tags.`);
        continue;
      }
      const questaoId = qRes.rows[0].id;

      // 3.4.1 estilo_cognitivo (categorica -> valor_id)
      const estiloNorm = normalizeEstiloSlug(tag.estilo_cognitivo);
      const dvKey = `estilo_cognitivo|${estiloNorm}`;
      const valorId = dvMap[dvKey] ?? null;

      if (!valorId) {
        console.warn(`  WARN: Q${tag.num} estilo_cognitivo="${tag.estilo_cognitivo}" (normalizado="${estiloNorm}") sem valor_id em dimensao_valores. Pulando.`);
        tagsError++;
      } else {
        // INSERT com ON CONFLICT: unique (questao_id, dimensao_id, valor_id)
        const r = await client.query(`
          INSERT INTO questao_tags (questao_id, dimensao_id, valor_id, origem)
          VALUES ($1, $2, $3, 'llm')
          ON CONFLICT (questao_id, dimensao_id, valor_id) DO NOTHING
        `, [questaoId, estiloDimId, valorId]);
        if (r.rowCount > 0) tagsInserted++; else tagsSkipped++;
      }

      // 3.4.2 dimensoes boolanas
      // NOTA: ON CONFLICT nao funciona para valor_id IS NULL (NULL != NULL em btree unique).
      // Idempotencia garantida via WHERE NOT EXISTS.
      for (const dimChave of tag.dimensoes) {
        const dimId = dimensaoMap[dimChave] ?? null;
        if (!dimId) {
          console.warn(`  WARN: Q${tag.num} dimensao="${dimChave}" nao encontrada em dimensoes. Pulando.`);
          tagsError++;
          continue;
        }

        const r = await client.query(`
          INSERT INTO questao_tags (questao_id, dimensao_id, valor_bool, origem)
          SELECT $1, $2, true, 'llm'
          WHERE NOT EXISTS (
            SELECT 1 FROM questao_tags
            WHERE questao_id  = $1
              AND dimensao_id = $2
              AND valor_bool IS NOT DISTINCT FROM true
              AND valor_id IS NULL
              AND origem = 'llm'
          )
        `, [questaoId, dimId]);
        if (r.rowCount > 0) tagsInserted++; else tagsSkipped++;
      }
    }

    console.log(`  tags inseridas: ${tagsInserted}`);
    console.log(`  tags ja existiam (skipped): ${tagsSkipped}`);
    console.log(`  tags com erro/nao resolvidas: ${tagsError}`);

    // ── 3.5 STEP 3: VERIFICAÇÃO ────────────────────────────────────────────
    console.log('\n=== STEP 3: VERIFICAÇÃO ===');

    const countRes = await client.query(`
      SELECT count(*) AS total, count(materia_id) AS com_materia
      FROM questoes
      WHERE exame_id = $1
    `, [exameId]);
    const { total, com_materia } = countRes.rows[0];
    console.log(`  questoes total: ${total} | com materia_id: ${com_materia}`);

    const distRes = await client.query(`
      SELECT m.nome, count(*) AS total
      FROM questoes q
      JOIN materias m ON m.id = q.materia_id
      WHERE q.exame_id = $1
      GROUP BY m.nome
      ORDER BY 2 DESC
    `, [exameId]);

    console.log('\n  Distribuicao por materia:');
    distRes.rows.forEach(r => {
      console.log(`    ${r.nome.padEnd(40)} ${r.total}`);
    });

    const totalTagsRes = await client.query(`
      SELECT count(*) AS total
      FROM questao_tags qt
      JOIN questoes q ON q.id = qt.questao_id
      WHERE q.exame_id = $1
    `, [exameId]);
    console.log(`\n  Total questao_tags (exame 42): ${totalTagsRes.rows[0].total}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
