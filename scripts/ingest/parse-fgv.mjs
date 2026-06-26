/**
 * parse-fgv.mjs — Parser OCR de provas FGV da OAB 1ª fase
 *
 * Roda com: node scripts/ingest/parse-fgv.mjs
 *
 * ESTRATÉGIA OCR (necessária porque fontes Calibri FGV não têm ToUnicode map):
 *   1. pdftoppm -r 300 -png  →  imagens das páginas de conteúdo (pula pág. 1)
 *   2. Divide cada imagem na metade esquerda/direita (layout 2 colunas)
 *   3. tesseract -l por em cada metade → concatena esquerda→direita por página
 *   4. Apaga os PNGs após OCR para economizar espaço
 *   5. Segmenta em 80 questões: número + enunciado + alternativas A/B/C/D
 *   6. pdftotext no gabarito → parse da linha Tipo 1 → mapa num→letra
 *   7. Saída JSON em /Volumes/Seagate 1/advoga-ingest/structured/ e data/structured/
 *
 * PONTOS DE AJUSTE POR EDIÇÃO:
 *   - META.* (número do exame, ano, tipo)
 *   - PROVA_PDF / GABARITO_PDF
 *   - Número de páginas: por default pula pg 1 (instruções), processa pg 2..N
 *   - COLUMN_SPLIT_X_RATIO: se o layout mudar de 2 colunas
 */

import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIGURAÇÃO DA EDIÇÃO ────────────────────────────────────────────────────

// Config por edição via env (fallback: 42). Ex.: EXAME=45 ANO=2025 node parse-fgv.mjs
const EXAME_NUMERO = Number(process.env.EXAME ?? 42);

const SEAGATE_BASE = "/Volumes/Seagate 1/advoga-ingest";
const PROJECT_ROOT = path.resolve(__dirname, "../../");

const META = {
  exame_numero: EXAME_NUMERO,
  ano: Number(process.env.ANO ?? 2024),
  tipo: 1,
  data_aplicacao: process.env.DATA ?? `${process.env.ANO ?? 2024}-01-01`,
};

const PROVA_PDF = process.env.PROVA ?? path.join(SEAGATE_BASE, "raw", `oab${EXAME_NUMERO}_tipo1.pdf`);
const GABARITO_PDF = process.env.GABARITO ?? path.join(SEAGATE_BASE, "raw", `oab${EXAME_NUMERO}_gabarito.pdf`);

const SEAGATE_OCR_DIR = path.join(SEAGATE_BASE, "ocr");
const SEAGATE_OUT = path.join(SEAGATE_BASE, "structured", `oab${EXAME_NUMERO}_tipo1.json`);
const LOCAL_OUT = path.join(PROJECT_ROOT, "data/structured", `oab${EXAME_NUMERO}_tipo1.json`);

// Proporção da divisão de coluna (esquerda vs direita).
// 0.50 = divide exatamente na metade da largura.
const COLUMN_SPLIT_X_RATIO = 0.50;

// Número esperado de questões
const EXPECTED_Q = 80;

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  const result = spawnSync("bash", ["-c", cmd], {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
    ...opts,
  });
  if (result.error) throw result.error;
  return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status };
}

function requireTool(name, testCmd) {
  const r = run(testCmd);
  if (r.status !== 0) {
    throw new Error(`Ferramenta '${name}' não disponível. Status: ${r.status}\n${r.stderr}`);
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ─── GABARITO (pdftotext) ─────────────────────────────────────────────────────

/**
 * Extrai o gabarito do Tipo especificado do PDF de gabarito via pdftotext.
 * Formato esperado no PDF:
 *   42º EXAME DE ORDEM UNIFICADO - PROVA TIPO 1
 *    1    2  ...  20
 *   D    B  ...  D
 *   ...
 */
function parseGabarito(pdfPath, tipo) {
  const r = run(`pdftotext -layout "${pdfPath}" -`);
  if (r.status !== 0) throw new Error(`pdftotext falhou: ${r.stderr}`);
  const content = r.stdout;

  // Rótulo varia por edição: "PROVA TIPO 1", "- TIPO 1", "TIPO 1"...
  const tipoRe = new RegExp(`\\bTIPO\\s+${tipo}\\b`, "i");
  const tipoMatch = tipoRe.exec(content);
  if (!tipoMatch) throw new Error(`Gabarito: não encontrou seção "TIPO ${tipo}"`);
  const tipoIdx = tipoMatch.index;

  const afterTipo = content.slice(tipoIdx + tipoMatch[0].length);
  const nextRel = afterTipo.search(/\bTIPO\s+\d+\b/i);
  const section = nextRel === -1
    ? content.slice(tipoIdx)
    : content.slice(tipoIdx, tipoIdx + tipoMatch[0].length + nextRel);

  const lines = section.split("\n").filter(l => l.trim());
  const gabarito = new Map();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    // Linha de números: múltiplos inteiros separados por espaço
    if (/^\d+(\s+\d+)+$/.test(line)) {
      const nums = line.split(/\s+/).map(Number);
      if (nums.every(n => n >= 1 && n <= 80) && nums.length > 1) {
        if (i + 1 < lines.length) {
          const ansLine = lines[i + 1].trim();
          const answers = ansLine.split(/\s+/);
          if (answers.length === nums.length) {
            for (let j = 0; j < nums.length; j++) {
              const ans = answers[j].toUpperCase();
              gabarito.set(nums[j], ans === "*" || ans === "" ? "ANULADA" : ans);
            }
            i += 2;
            continue;
          }
        }
      }
    }
    i++;
  }

  return gabarito;
}

// ─── OCR DE UMA COLUNA ────────────────────────────────────────────────────────

/**
 * Rende uma metade de uma página como PNG temporário e roda tesseract.
 * Apaga o PNG após extrair o texto.
 */
function ocrHalf(fullPagePng, half, pageNum) {
  const tmpPng = path.join(SEAGATE_OCR_DIR, `p${pageNum}_${half}.png`);

  // Usar Python/PIL para dividir a imagem
  const pyScript = `
from PIL import Image
img = Image.open(${JSON.stringify(fullPagePng)})
w, h = img.size
midX = int(w * ${COLUMN_SPLIT_X_RATIO})
if ${JSON.stringify(half)} == 'left':
    cropped = img.crop((0, 0, midX, h))
else:
    cropped = img.crop((midX, 0, w, h))
# Pequena margem de 5px para não cortar texto na borda
cropped.save(${JSON.stringify(tmpPng)})
`;
  const pyResult = run(`python3 -c '${pyScript.replace(/'/g, "'\\''")}'`);
  if (pyResult.status !== 0) {
    throw new Error(`PIL split falhou (page ${pageNum} ${half}): ${pyResult.stderr}`);
  }

  // OCR com tesseract
  const tResult = run(`tesseract "${tmpPng}" stdout -l por --oem 1 --psm 6 2>/dev/null`);
  const text = tResult.stdout;

  // Apagar PNG imediatamente
  try { fs.unlinkSync(tmpPng); } catch (_) { /* ignore */ }

  return text;
}

// ─── OCR DE TODAS AS PÁGINAS ──────────────────────────────────────────────────

/**
 * Renderiza cada página de conteúdo (pg 2..N), OCR em 2 colunas, concatena.
 * Retorna texto completo do exame (todas as páginas, esq→dir).
 */
async function ocrAllPages(pdfPath) {
  // Descobrir número de páginas
  const infoR = run(`pdfinfo "${pdfPath}"`);
  const pagesMatch = infoR.stdout.match(/Pages:\s+(\d+)/);
  if (!pagesMatch) throw new Error("Não foi possível determinar número de páginas do PDF");
  const totalPages = parseInt(pagesMatch[1], 10);
  console.log(`   PDF: ${totalPages} páginas totais.`);

  const allText = [];
  let totalPngBytes = 0;

  // Página 1 = capa/instruções (pular)
  // Página N (última) = pesquisa de satisfação + tabela de correspondência (pular)
  // Conteúdo real: páginas 2 .. totalPages-1
  const firstContentPage = 2;
  const lastContentPage = totalPages - 1;
  console.log(`   Processando pg ${firstContentPage}..${lastContentPage} (pula pg 1=instruções, pg ${totalPages}=pesquisa).`);

  for (let pgNum = firstContentPage; pgNum <= lastContentPage; pgNum++) {
    process.stdout.write(`   Página ${pgNum}/${lastContentPage}...`);

    // Renderizar apenas esta página
    const pngPrefix = path.join(SEAGATE_OCR_DIR, `prova_pg`);
    const pngFile = `${pngPrefix}-${String(pgNum).padStart(2, "0")}.png`;

    const renderR = run(`pdftoppm -r 300 -png -f ${pgNum} -l ${pgNum} "${pdfPath}" "${pngPrefix}"`);
    if (renderR.status !== 0) throw new Error(`pdftoppm falhou na pg ${pgNum}: ${renderR.stderr}`);

    if (!fs.existsSync(pngFile)) {
      throw new Error(`PNG não gerado para pg ${pgNum}: esperado ${pngFile}`);
    }

    const pngStat = fs.statSync(pngFile);
    totalPngBytes += pngStat.size;

    // OCR coluna esquerda
    const leftText = ocrHalf(pngFile, "left", pgNum);
    // OCR coluna direita
    const rightText = ocrHalf(pngFile, "right", pgNum);

    // Apagar o PNG da página após OCR
    try { fs.unlinkSync(pngFile); } catch (_) { /* ignore */ }

    allText.push(`\n--- PAGINA ${pgNum} ESQUERDA ---\n${leftText}`);
    allText.push(`\n--- PAGINA ${pgNum} DIREITA ---\n${rightText}`);

    process.stdout.write(` OK\n`);
  }

  console.log(`   PNGs gerados e apagados. Tamanho total estimado: ${(totalPngBytes / 1024 / 1024).toFixed(1)} MB`);
  return allText.join("\n");
}

// ─── SEGMENTAÇÃO DAS QUESTÕES ─────────────────────────────────────────────────

/**
 * Limpeza de linha OCR:
 * - Remove ruído de cabeçalho/rodapé FGV ("Tipo 1 – Branca – Página N", "CONSELHO FEDERAL...")
 * - Normaliza espaços
 */
function cleanOcrLine(line) {
  const l = line.trim();
  // Ruídos comuns de cabeçalho/rodapé
  if (/^(CONSELHO FEDERAL|42[oº°]\s*EXAME|EXAME DO ORDEM|EXAME DE ORDEM|OAB)/i.test(l)) return "";
  if (/^Tipo\s+\d+\s*[–-]\s*\w+\s*[–-]\s*Página\s+\d+/i.test(l)) return "";
  if (/^Página\s+\d+\s*$/i.test(l)) return "";
  if (/^SAD\s*$/i.test(l)) return "";
  if (/^---\s*PAGINA\s+\d+\s+(ESQUERDA|DIREITA)\s*---/.test(l)) return "";
  return l;
}

/**
 * Segmenta o texto OCR bruto em 80 questões.
 *
 * Estratégia:
 *   - Procura cabeçalhos de questão: linha que é apenas um número (1..80)
 *     ou "QUESTÃO N" ou similar.
 *   - Dentro de cada bloco, detecta alternativas A) B) C) D) com regex robusto
 *     para absorver variações OCR ("A )", "A.", "A -", "(A)").
 *   - Enunciado = tudo antes da primeira alternativa no bloco.
 *   - Alternativa D termina na próxima questão ou no final.
 */
function segmentQuestoes(fullText) {
  // Limpar linhas
  const lines = fullText
    .split("\n")
    .map(cleanOcrLine)
    .filter(Boolean);

  // Detecta início de questão: linha que é (exatamente) um número 1..80
  // Aceita também "1." "1:" "Questão 1" etc.
  const qHeaderRe = /^(?:QUEST[AÃÀ]O\s+)?(\d{1,2})[.:]?\s*$/i;

  // Detecta alternativa: A) B) C) D) com variações OCR
  // "A)" "A )" "A." "A -" "(A)" "A|" etc.
  const altRe = /^[(\s]*([ABCD])\s*[).|\-:]\s*/;

  // Primeira passagem: encontrar posições dos cabeçalhos de questão
  const qStarts = []; // [{lineIdx, qNum, rawNum}]
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(qHeaderRe);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 80) {
        // Evitar duplicatas consecutivas
        if (qStarts.length === 0 || qStarts[qStarts.length - 1].qNum !== n) {
          qStarts.push({ lineIdx: i, qNum: n, rawNum: n });
        }
      }
    }
  }

  // Passagem de correção de sequência: detecta e repara números OCR errados.
  // Heurística: se qNum[i] < qNum[i-1] E qNum[i] já existe antes na lista,
  // provavelmente é um misread. Tenta candidatos: qNum[i-1]+1, qNum[i-1]+5, etc.
  // Caso específico: "1" misread de "7" (75→15, 76→16... ou 71→11, etc.)
  // Estratégia: se o número regride mas o bloco não é o início do documento,
  // e o número deslocado (candidato = último+1) está no range válido, usá-lo.
  for (let i = 1; i < qStarts.length; i++) {
    const prev = qStarts[i - 1].qNum;
    const curr = qStarts[i].qNum;
    // Se regrediu OU está muito longe do esperado (salto > 10)
    if (curr <= prev || curr > prev + 6) {
      // Candidato natural: prev + 1
      const candidate = prev + 1;
      if (candidate >= 1 && candidate <= 80) {
        qStarts[i] = { ...qStarts[i], qNum: candidate };
      }
    }
  }

  // Segunda passagem: extrair conteúdo de cada bloco
  const questoes = new Map(); // qNum → {enunciado, A, B, C, D}

  for (let qi = 0; qi < qStarts.length; qi++) {
    const { lineIdx: startLine, qNum } = qStarts[qi];
    const endLine = qi + 1 < qStarts.length ? qStarts[qi + 1].lineIdx : lines.length;

    const blockLines = lines.slice(startLine + 1, endLine);

    // Encontrar as 4 alternativas dentro do bloco
    const altPositions = { A: -1, B: -1, C: -1, D: -1 };
    for (let i = 0; i < blockLines.length; i++) {
      const m = blockLines[i].match(altRe);
      if (m && altPositions[m[1]] === -1) {
        altPositions[m[1]] = i;
      }
    }

    const hasAllAlts = altPositions.A >= 0 && altPositions.B >= 0 &&
                       altPositions.C >= 0 && altPositions.D >= 0;

    if (!hasAllAlts) {
      // Bloco incompleto — pode ser ruído ou página dividida; pular
      continue;
    }

    // Verificar ordem A < B < C < D
    if (!(altPositions.A < altPositions.B &&
          altPositions.B < altPositions.C &&
          altPositions.C < altPositions.D)) {
      continue; // Ordem quebrada = bloco inválido
    }

    // Enunciado: linhas do bloco antes de A
    const enunciadoLines = blockLines.slice(0, altPositions.A);
    const enunciado = enunciadoLines.join(" ").replace(/\s+/g, " ").trim();

    // Texto de cada alternativa (remove o marcador da primeira linha)
    function altText(startIdx, endIdx) {
      const firstLine = blockLines[startIdx].replace(altRe, "").trim();
      const rest = blockLines.slice(startIdx + 1, endIdx).join(" ");
      return `${firstLine} ${rest}`.replace(/\s+/g, " ").trim();
    }

    const altA = altText(altPositions.A, altPositions.B);
    const altB = altText(altPositions.B, altPositions.C);
    const altC = altText(altPositions.C, altPositions.D);
    const altD = altText(altPositions.D, blockLines.length);

    // Only set if not already found (first occurrence wins for correct numbers;
    // for corrected/inferred numbers this is always a new slot)
    if (!questoes.has(qNum)) {
      questoes.set(qNum, {
        enunciado,
        A: altA,
        B: altB,
        C: altC,
        D: altD,
      });
    }
  }

  return questoes;
}

// ─── VERIFICAÇÕES ─────────────────────────────────────────────────────────────

function verifyQuestoes(questoes) {
  const checks = [];
  const warnings = [];

  // Check 1: Contagem
  checks.push({
    name: `Total de questões = ${EXPECTED_Q}`,
    passed: questoes.length === EXPECTED_Q,
    detail: `Encontradas: ${questoes.length}`,
  });

  // Check 2: 4 alternativas não-vazias
  const badAlts = questoes.filter(
    q => !q.alternativas.A?.trim() || !q.alternativas.B?.trim() ||
         !q.alternativas.C?.trim() || !q.alternativas.D?.trim()
  );
  checks.push({
    name: "Todas com 4 alternativas não-vazias",
    passed: badAlts.length === 0,
    detail: badAlts.length === 0 ? "OK" : `Problemas: Q${badAlts.map(q => q.num).join(", Q")}`,
  });

  // Check 3 (genérico): enunciados legíveis — todos com tamanho mínimo (não vazio/garbled)
  const shortEnunc3 = questoes.filter(q => (q.enunciado || "").trim().length < 30);
  const q1ref = questoes.find(q => q.num === 1);
  checks.push({
    name: "Enunciados legíveis (>= 30 chars)",
    passed: shortEnunc3.length === 0,
    detail: shortEnunc3.length === 0
      ? `OK | Q1: "${(q1ref?.enunciado || "").slice(0, 70)}..."`
      : `Curtos: Q${shortEnunc3.map(q => q.num).join(", Q")}`,
  });

  // Check 4: Gabarito válido para todos
  const validGab = new Set(["A", "B", "C", "D", "ANULADA"]);
  const badGab = questoes.filter(q => !validGab.has(q.gabarito));
  checks.push({
    name: "Todas com gabarito válido",
    passed: badGab.length === 0,
    detail: badGab.length === 0 ? "OK" : `Sem gabarito: Q${badGab.map(q => `${q.num}=${q.gabarito}`).join(", Q")}`,
  });

  // Check 5 (genérico): números de questão 1..80 todos presentes (integridade)
  const numsSet = new Set(questoes.map(q => q.num));
  const faltando = [];
  for (let n = 1; n <= EXPECTED_Q; n++) if (!numsSet.has(n)) faltando.push(n);
  checks.push({
    name: "Números de questão 1..80 completos",
    passed: faltando.length === 0,
    detail: faltando.length === 0 ? "OK" : `Faltando: Q${faltando.join(", Q")}`,
  });

  // Check 6: ANULADAs (informativo)
  const anuladas = questoes.filter(q => q.gabarito === "ANULADA");
  checks.push({
    name: "Contagem de ANULADAs (informativo)",
    passed: true,
    detail: anuladas.length === 0
      ? "Nenhuma questão anulada"
      : `${anuladas.length} anulada(s): Q${anuladas.map(q => q.num).join(", Q")}`,
  });

  // Enunciados curtos
  const shortEnunc = questoes.filter(q => q.enunciado.trim().length < 20);
  if (shortEnunc.length > 0) {
    warnings.push(`Enunciados curtos (<20 chars): Q${shortEnunc.map(q => q.num).join(", Q")}`);
  }

  const criticalChecks = checks.filter(c => !c.name.startsWith("Contagem de ANULADA"));
  const ok = criticalChecks.every(c => c.passed);

  return { ok, checks, warnings };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Parser FGV OAB (OCR) — ${META.exame_numero}º EOU Tipo ${META.tipo}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Verificar pré-requisitos ───────────────────────────────────────────────
  console.log("1. Verificando pré-requisitos...");

  if (!fs.existsSync(PROVA_PDF)) throw new Error(`PDF prova não encontrado: ${PROVA_PDF}`);
  if (!fs.existsSync(GABARITO_PDF)) throw new Error(`PDF gabarito não encontrado: ${GABARITO_PDF}`);

  requireTool("pdftoppm", "which pdftoppm");
  requireTool("tesseract", "which tesseract");
  requireTool("pdftotext", "which pdftotext");

  // Verificar Python + PIL
  const pilR = run("python3 -c 'from PIL import Image; print(\"PIL OK\")'");
  if (pilR.status !== 0 || !pilR.stdout.includes("PIL OK")) {
    throw new Error("Pillow não disponível. Instale com: pip3 install Pillow");
  }

  // Verificar língua portuguesa no tesseract
  const tessLangR = run("tesseract --list-langs 2>&1");
  if (!tessLangR.stdout.includes("por")) {
    throw new Error("Tesseract: língua 'por' não instalada. Instale com: brew install tesseract-lang");
  }

  ensureDir(SEAGATE_OCR_DIR);
  ensureDir(path.dirname(SEAGATE_OUT));
  ensureDir(path.dirname(LOCAL_OUT));

  console.log(`   PDF prova: ${path.basename(PROVA_PDF)}`);
  console.log(`   PDF gabarito: ${path.basename(GABARITO_PDF)}`);
  console.log(`   Workspace OCR: ${SEAGATE_OCR_DIR}\n`);

  // ── Gabarito ───────────────────────────────────────────────────────────────
  console.log("2. Parseando gabarito via pdftotext...");
  const gabaritoMap = parseGabarito(GABARITO_PDF, META.tipo);
  console.log(`   Tipo ${META.tipo}: ${gabaritoMap.size} questões mapeadas`);
  if (gabaritoMap.size !== 80) {
    console.warn(`   AVISO: esperado 80, encontrado ${gabaritoMap.size}`);
  }
  const first10gab = Array.from({ length: 10 }, (_, i) => gabaritoMap.get(i + 1) || "?").join(",");
  console.log(`   Primeiros 10: ${first10gab}\n`);

  // ── OCR ────────────────────────────────────────────────────────────────────
  console.log("3. Renderizando e fazendo OCR (2 colunas por página)...");
  const ocrStart = Date.now();
  const fullText = await ocrAllPages(PROVA_PDF);
  const ocrSeconds = ((Date.now() - ocrStart) / 1000).toFixed(1);
  console.log(`   OCR concluído em ${ocrSeconds}s\n`);

  // ── Segmentação ────────────────────────────────────────────────────────────
  console.log("4. Segmentando questões...");
  const questaoMap = segmentQuestoes(fullText);
  console.log(`   Questões segmentadas: ${questaoMap.size}\n`);

  // ── Montar saída ───────────────────────────────────────────────────────────
  console.log("5. Montando questões com gabarito...");
  const parseWarnings = [];
  const questoes = [];

  for (let num = 1; num <= 80; num++) {
    const qData = questaoMap.get(num);
    const gabarito = gabaritoMap.get(num);

    if (!qData) {
      parseWarnings.push(`Q${num}: não encontrada na segmentação OCR`);
      questoes.push({
        num,
        enunciado: `[NÃO EXTRAÍDO — Q${num}]`,
        alternativas: { A: "", B: "", C: "", D: "" },
        gabarito: gabarito ?? "ERRO_SEM_GABARITO",
      });
      continue;
    }

    if (!gabarito) {
      parseWarnings.push(`Q${num}: gabarito não encontrado`);
    }

    questoes.push({
      num,
      enunciado: qData.enunciado,
      alternativas: {
        A: qData.A,
        B: qData.B,
        C: qData.C,
        D: qData.D,
      },
      gabarito: gabarito ?? "ERRO_SEM_GABARITO",
    });
  }

  questoes.sort((a, b) => a.num - b.num);

  // ── Verificações ───────────────────────────────────────────────────────────
  console.log("\n5. Verificações:\n");
  const { ok, checks, warnings: checkWarnings } = verifyQuestoes(questoes);

  for (const check of checks) {
    const icon = check.passed ? "✓" : "✗";
    console.log(`   ${icon} ${check.name}`);
    console.log(`     → ${check.detail}`);
  }

  if (checkWarnings.length > 0) {
    console.log("\n   Avisos:");
    for (const w of checkWarnings) console.log(`   ! ${w}`);
  }
  if (parseWarnings.length > 0) {
    console.log("\n   Warnings do parse:");
    for (const w of parseWarnings) console.log(`   ! ${w}`);
  }

  // ── Salvar JSON ────────────────────────────────────────────────────────────
  const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

  const output = {
    exame: {
      numero: META.exame_numero,
      ano: META.ano,
      tipo: META.tipo,
      data_aplicacao: META.data_aplicacao,
    },
    questoes,
    _parse_meta: {
      parsed_at: new Date().toISOString(),
      source_pdf: PROVA_PDF,
      gabarito_pdf: GABARITO_PDF,
      warnings: [...parseWarnings, ...checkWarnings],
      engine: "OCR: pdftoppm 300dpi + tesseract -l por (2 colunas por página)",
      ocr_seconds: parseFloat(ocrSeconds),
      total_seconds: parseFloat(totalSeconds),
    },
  };

  fs.writeFileSync(SEAGATE_OUT, JSON.stringify(output, null, 2), "utf-8");
  fs.writeFileSync(LOCAL_OUT, JSON.stringify(output, null, 2), "utf-8");

  const seagateSizeKb = Math.round(fs.statSync(SEAGATE_OUT).size / 1024);

  // Espaço em uso no Seagate
  const dfR = run(`df -h "/Volumes/Seagate 1" | tail -1`);
  const dfLine = dfR.stdout.trim();

  console.log(`\n6. Saídas salvas:`);
  console.log(`   Seagate: ${SEAGATE_OUT} (${seagateSizeKb} KB)`);
  console.log(`   Local:   ${LOCAL_OUT}`);
  console.log(`   Seagate espaço: ${dfLine}`);
  console.log(`   Tempo total: ${totalSeconds}s`);

  // ── Q1 primeiras palavras ──────────────────────────────────────────────────
  const q1 = questoes[0];
  const q1Words = (q1?.enunciado || "").split(/\s+/).slice(0, 15).join(" ");
  console.log(`\n   Q1 (15 primeiras palavras): "${q1Words}"`);

  // ── Resultado ─────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  if (ok) {
    console.log("  RESULTADO: TODOS OS CHECKS PASSARAM ✓");
  } else {
    const failed = checks.filter(c => !c.passed).map(c => c.name);
    console.log("  RESULTADO: CHECKS FALHARAM ✗");
    for (const f of failed) console.log(`    - ${f}`);
    process.exit(1);
  }
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("\nERRO FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
