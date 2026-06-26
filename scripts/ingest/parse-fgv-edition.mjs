#!/usr/bin/env node
/**
 * parse-fgv-edition.mjs — Parser OCR parametrizado por edição
 *
 * Uso: node scripts/ingest/parse-fgv-edition.mjs <edicao>
 *   ex: node scripts/ingest/parse-fgv-edition.mjs 43
 *
 * Pré-requisito: PDFs já baixados em /Volumes/Seagate 1/advoga-ingest/raw/
 *   oab{N}_tipo1.pdf
 *   oab{N}_gabarito.pdf
 *
 * Saída JSON: /Volumes/Seagate 1/advoga-ingest/structured/oab{N}_tipo1.json
 *             data/structured/oab{N}_tipo1.json (cópia local)
 */

import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../");
const SEAGATE_BASE = "/Volumes/Seagate 1/advoga-ingest";

// ─── CONFIGURAÇÃO POR EDIÇÃO ──────────────────────────────────────────────────
// Ajustes necessários baseados em quirks de cada exame.
// column_split: proporção da divisão esquerda/direita (0.49 usado na 42ª)
// page_range: [first, last_offset] onde last_offset é quantas páginas pular no fim
//             ex: [2, 1] = começa pg 2, pula última pg. [2, 2] = pula 2 últimas.
// gabarito_type: "tipo_N" ou "label" para a regex no PDF de gabarito

const EDITION_CONFIG = {
  37: {
    exame_numero: 37,
    ano: 2023,
    data_aplicacao: "2023-02-26",
    column_split: 0.49,
    page_first: 2,
    page_last_skip: 1,
    // Gabarito 37 é um doc combinado grande — seção esperada: "PROVA TIPO 1"
    gabarito_tipo_label: "PROVA TIPO 1",
    // Q1 spot-check: palavras esperadas no enunciado ou alternativas
    q1_keywords: [],
  },
  38: {
    exame_numero: 38,
    ano: 2023,
    data_aplicacao: "2023-07-09",
    column_split: 0.49,
    page_first: 2,
    page_last_skip: 1,
    gabarito_tipo_label: "PROVA TIPO 1",
    q1_keywords: [],
  },
  39: {
    exame_numero: 39,
    ano: 2023,
    data_aplicacao: "2023-11-19",
    column_split: 0.49,
    page_first: 2,
    page_last_skip: 1,
    gabarito_tipo_label: "PROVA TIPO 1",
    q1_keywords: [],
  },
  40: {
    exame_numero: 40,
    ano: 2024,
    data_aplicacao: "2024-03-24",
    column_split: 0.49,
    page_first: 2,
    page_last_skip: 1,
    gabarito_tipo_label: "PROVA TIPO 1",
    q1_keywords: [],
  },
  41: {
    exame_numero: 41,
    ano: 2024,
    data_aplicacao: "2024-07-28",
    column_split: 0.49,
    page_first: 2,
    page_last_skip: 1,
    gabarito_tipo_label: "PROVA TIPO 1",
    q1_keywords: [],
  },
  43: {
    exame_numero: 43,
    ano: 2025,
    data_aplicacao: "2025-04-27",
    column_split: 0.49,
    page_first: 2,
    page_last_skip: 1,
    gabarito_tipo_label: "PROVA TIPO 1",
    q1_keywords: [],
  },
  44: {
    exame_numero: 44,
    ano: 2025,
    data_aplicacao: "2025-08-17",
    column_split: 0.49,
    page_first: 2,
    page_last_skip: 1,
    gabarito_tipo_label: "PROVA TIPO 1",
    q1_keywords: [],
  },
  45: {
    exame_numero: 45,
    ano: 2025,
    data_aplicacao: "2025-12-21",
    column_split: 0.49,
    page_first: 2,
    page_last_skip: 1,
    gabarito_tipo_label: "PROVA TIPO 1",
    q1_keywords: [],
  },
  46: {
    exame_numero: 46,
    ano: 2026,
    data_aplicacao: "2026-05-03",
    column_split: 0.49,
    page_first: 2,
    page_last_skip: 1,
    gabarito_tipo_label: "PROVA TIPO 1",
    q1_keywords: [],
  },
};

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  const result = spawnSync("bash", ["-c", cmd], {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
    ...opts,
  });
  if (result.error) throw result.error;
  return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status };
}

function requireTool(name, testCmd) {
  const r = run(testCmd);
  if (r.status !== 0) throw new Error(`Ferramenta '${name}' não disponível: ${r.stderr}`);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ─── GABARITO ─────────────────────────────────────────────────────────────────

/**
 * Extrai gabarito do PDF via pdftotext.
 * Tenta dois formatos:
 *   Formato A: "PROVA TIPO 1" + linha de números + linha de letras
 *   Formato B: tabela com "Tipo" nos cabeçalhos de coluna
 */
function parseGabarito(pdfPath, edicaoNum) {
  const r = run(`pdftotext -layout "${pdfPath}" -`);
  if (r.status !== 0) throw new Error(`pdftotext falhou: ${r.stderr}`);
  const content = r.stdout;

  // Debug: salvar texto do gabarito para inspeção se falhar
  const debugPath = path.join(SEAGATE_BASE, "ocr", `oab${edicaoNum}_gabarito_debug.txt`);

  const tipoLabel = `PROVA TIPO 1`;
  const tipoIdx = content.indexOf(tipoLabel);

  if (tipoIdx !== -1) {
    const nextTipoIdx = content.indexOf("PROVA TIPO", tipoIdx + tipoLabel.length);
    const section = nextTipoIdx === -1
      ? content.slice(tipoIdx)
      : content.slice(tipoIdx, nextTipoIdx);

    const gabarito = parseGabaritoSection(section);
    if (gabarito.size >= 70) return gabarito; // Sucesso se >= 70 questões
  }

  // Fallback: tentar sem a string exata "PROVA TIPO 1"
  // Algumas edições usam "Tipo 1" ou "TIPO 1"
  const altIdx = content.search(/TIPO\s+1/i);
  if (altIdx !== -1) {
    const altNextIdx = content.search(/TIPO\s+[234]/i);
    const section = altNextIdx !== -1
      ? content.slice(altIdx, altNextIdx)
      : content.slice(altIdx);
    const gabarito = parseGabaritoSection(section);
    if (gabarito.size >= 70) return gabarito;
  }

  // Fallback 2: formato "EXAME DE ORDEM UNIFICADO - PROVA 1" (ed.39 e similares)
  // Neste formato: linha de números 1..20, seguida de linha de respostas
  const provaIdx = content.search(/EXAME(?:\s+DE\s+ORDEM\s+UNIFICADO)?\s*[-–]\s*PROVA\s+1/i);
  if (provaIdx !== -1) {
    const provaNextIdx = content.search(/EXAME(?:\s+DE\s+ORDEM\s+UNIFICADO)?\s*[-–]\s*PROVA\s+[234]/i);
    const section = provaNextIdx !== -1
      ? content.slice(provaIdx, provaNextIdx)
      : content.slice(provaIdx);
    const gabarito = parseGabaritoSection(section);
    if (gabarito.size >= 70) return gabarito;
  }

  // Fallback 3: tentar parse de tabela com colunas de tipos
  const gabCol = parseGabaritoTableFormat(content);
  if (gabCol.size >= 70) return gabCol;

  // Se tudo falhar, salvar debug e lançar erro
  fs.writeFileSync(debugPath, content, "utf-8");
  throw new Error(
    `Gabarito: não encontrou seção "PROVA TIPO 1" com >= 70 questões. ` +
    `Texto salvo em ${debugPath} para inspeção. ` +
    `Tamanho do texto: ${content.length} chars. ` +
    `Primeiras 500 chars: ${content.slice(0, 500)}`
  );
}

function parseGabaritoSection(section) {
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

/**
 * Parse alternativo para gabaritos em formato de tabela:
 *   Q | Tipo 1 | Tipo 2 | Tipo 3 | Tipo 4
 *   1 |   A    |   C    |   B    |   D
 * Extrai coluna "Tipo 1" (2ª coluna).
 */
function parseGabaritoTableFormat(content) {
  const gabarito = new Map();
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Linha com número de questão seguido de letras (separadas por espaços/pipes)
    const m = line.match(/^\s*(\d{1,2})\s+([ABCD\*])\s+([ABCD\*])/i);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= 80 && !gabarito.has(num)) {
        const ans = m[2].toUpperCase();
        gabarito.set(num, ans === "*" ? "ANULADA" : ans);
      }
    }
  }
  return gabarito;
}

// ─── OCR ──────────────────────────────────────────────────────────────────────

function ocrHalf(fullPagePng, half, pageNum, ocrDir, columnSplitRatio) {
  const tmpPng = path.join(ocrDir, `p${pageNum}_${half}.png`);

  const pyScript = `
from PIL import Image
img = Image.open(${JSON.stringify(fullPagePng)})
w, h = img.size
midX = int(w * ${columnSplitRatio})
if ${JSON.stringify(half)} == 'left':
    cropped = img.crop((0, 0, midX, h))
else:
    cropped = img.crop((midX, 0, w, h))
cropped.save(${JSON.stringify(tmpPng)})
`;
  const pyResult = run(`python3 -c '${pyScript.replace(/'/g, "'\\''")}'`);
  if (pyResult.status !== 0) {
    throw new Error(`PIL split falhou (page ${pageNum} ${half}): ${pyResult.stderr}`);
  }

  const tResult = run(`tesseract "${tmpPng}" stdout -l por --oem 1 --psm 6 2>/dev/null`);
  const text = tResult.stdout;

  try { fs.unlinkSync(tmpPng); } catch (_) {}

  return text;
}

async function ocrAllPages(pdfPath, config, ocrDir) {
  const infoR = run(`pdfinfo "${pdfPath}"`);
  const pagesMatch = infoR.stdout.match(/Pages:\s+(\d+)/);
  if (!pagesMatch) throw new Error("Não foi possível determinar número de páginas do PDF");
  const totalPages = parseInt(pagesMatch[1], 10);
  console.log(`   PDF: ${totalPages} páginas totais.`);

  const firstContentPage = config.page_first;
  const lastContentPage = totalPages - config.page_last_skip;
  console.log(`   Processando pg ${firstContentPage}..${lastContentPage}`);

  const allText = [];
  let totalPngBytes = 0;

  for (let pgNum = firstContentPage; pgNum <= lastContentPage; pgNum++) {
    process.stdout.write(`   Página ${pgNum}/${lastContentPage}...`);

    const pngPrefix = path.join(ocrDir, `prova_pg`);
    // pdftoppm gera nomes com padding baseado no total de páginas
    const pgStr = String(pgNum).padStart(Math.max(2, String(totalPages).length), "0");
    const pngFile = `${pngPrefix}-${pgStr}.png`;

    const renderR = run(`pdftoppm -r 300 -png -f ${pgNum} -l ${pgNum} "${pdfPath}" "${pngPrefix}"`);
    if (renderR.status !== 0) throw new Error(`pdftoppm falhou na pg ${pgNum}: ${renderR.stderr}`);

    // Encontrar o PNG gerado (pdftoppm pode usar padding diferente)
    let actualPng = pngFile;
    if (!fs.existsSync(pngFile)) {
      // Procurar PNG com qualquer padding
      const files = fs.readdirSync(ocrDir).filter(f => f.startsWith("prova_pg-") && f.endsWith(".png"));
      if (files.length === 1) {
        actualPng = path.join(ocrDir, files[0]);
      } else {
        throw new Error(`PNG não gerado para pg ${pgNum}: esperado ${pngFile}. Arquivos no dir: ${files.join(", ")}`);
      }
    }

    const pngStat = fs.statSync(actualPng);
    totalPngBytes += pngStat.size;

    const leftText = ocrHalf(actualPng, "left", pgNum, ocrDir, config.column_split);
    const rightText = ocrHalf(actualPng, "right", pgNum, ocrDir, config.column_split);

    try { fs.unlinkSync(actualPng); } catch (_) {}

    allText.push(`\n--- PAGINA ${pgNum} ESQUERDA ---\n${leftText}`);
    allText.push(`\n--- PAGINA ${pgNum} DIREITA ---\n${rightText}`);

    process.stdout.write(` OK\n`);
  }

  console.log(`   PNGs gerados e apagados. Total estimado: ${(totalPngBytes / 1024 / 1024).toFixed(1)} MB`);
  return allText.join("\n");
}

// ─── SEGMENTAÇÃO ──────────────────────────────────────────────────────────────

function cleanOcrLine(line, edicaoNum) {
  const l = line.trim();
  if (!l) return "";
  // Ruídos comuns de cabeçalho/rodapé FGV (genérico para qualquer edição)
  if (/^(CONSELHO FEDERAL|EXAME DO ORDEM|EXAME DE ORDEM)/i.test(l)) return "";
  if (/^OAB\s*[–-]/i.test(l)) return "";
  if (/^\d{2}[oº°]\s*EXAME/i.test(l)) return "";
  if (/^Tipo\s+\d+\s*[–-]/i.test(l)) return "";
  if (/^Página\s+\d+\s*$/i.test(l)) return "";
  if (/^SAD\s*$/i.test(l)) return "";
  if (/^---\s*PAGINA\s+\d+\s+(ESQUERDA|DIREITA)\s*---/.test(l)) return "";
  // Ruído de número de página sozinho no rodapé
  if (/^\d{1,3}\s*$/.test(l) && parseInt(l, 10) > 80) return "";
  return l;
}

function segmentQuestoes(fullText, edicaoNum) {
  const lines = fullText
    .split("\n")
    .map(l => cleanOcrLine(l, edicaoNum))
    .filter(Boolean);

  const qHeaderRe = /^(?:QUEST[AÃÀ]O\s+)?(\d{1,2})[.:]?\s*$/i;
  // altRe: aceita "A)", "A) ", "A. ", "(A)", etc.
  // Também aceita "Cc)" — OCR às vezes lê "C)" como "Cc)" (OCR artefato de letra duplicada)
  const altRe = /^[(\s]*([ABCD])[a-z]?\s*[).|\-:]\s*/;

  // Coletar TODOS os candidatos a cabeçalho de questão (sem dedup consecutivo ainda)
  const rawCandidates = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(qHeaderRe);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 80) {
        rawCandidates.push({ lineIdx: i, qNum: n });
      }
    }
  }

  // Pré-filtro: remover ruídos de número de página.
  // Um candidato é ruído quando:
  //   (a) qNum regride em relação ao candidato anterior (indica que não é sequência real), E
  //   (b) o próximo candidato tem o qNum que seria esperado na sequência (prevQNum+1).
  // Isso cobre o padrão: ..., Q36, "10" (pág), Q37, Q38, ...
  // onde "10" regride e logo em seguida vem Q37 (= prevQNum+1 = 36+1).
  // Também cobre: ..., Q41, "11" (pág), Q42, ...
  const candidatesPrefiltered = [];
  for (let i = 0; i < rawCandidates.length; i++) {
    if (i === 0) {
      candidatesPrefiltered.push(rawCandidates[i]);
      continue;
    }
    const prev = candidatesPrefiltered.length > 0
      ? candidatesPrefiltered[candidatesPrefiltered.length - 1].qNum
      : rawCandidates[i - 1].qNum;
    const curr = rawCandidates[i].qNum;
    const next = i + 1 < rawCandidates.length ? rawCandidates[i + 1].qNum : null;

    // Se curr regride E o próximo é exatamente prev+1, este é ruído de página
    const isPageNoise = curr < prev && next !== null && next === prev + 1;
    if (isPageNoise) {
      // pular — ruído de número de página
      continue;
    }
    candidatesPrefiltered.push(rawCandidates[i]);
  }

  // Dedup consecutivo com mesmo qNum
  const qStarts = [];
  for (const c of candidatesPrefiltered) {
    if (qStarts.length === 0 || qStarts[qStarts.length - 1].qNum !== c.qNum) {
      qStarts.push(c);
    }
  }

  // Correção de sequência: corrigir regressões e saltos grandes remanescentes
  // (não mais em cascata porque ruídos foram removidos antes)
  for (let i = 1; i < qStarts.length; i++) {
    const prev = qStarts[i - 1].qNum;
    const curr = qStarts[i].qNum;
    if (curr <= prev || curr > prev + 6) {
      const candidate = prev + 1;
      if (candidate >= 1 && candidate <= 80) {
        qStarts[i] = { ...qStarts[i], qNum: candidate };
      }
    }
  }

  // Dedup pós-correção (caso correção crie duplicatas)
  const qStartsFiltered = [];
  for (const q of qStarts) {
    const curr = q.qNum;
    if (qStartsFiltered.length === 0 || qStartsFiltered[qStartsFiltered.length - 1].qNum !== curr) {
      qStartsFiltered.push(q);
    }
  }

  const questoes = new Map();

  for (let qi = 0; qi < qStartsFiltered.length; qi++) {
    const { lineIdx: startLine, qNum } = qStartsFiltered[qi];
    const endLine = qi + 1 < qStartsFiltered.length ? qStartsFiltered[qi + 1].lineIdx : lines.length;
    const blockLines = lines.slice(startLine + 1, endLine);

    const altPositions = { A: -1, B: -1, C: -1, D: -1 };
    for (let i = 0; i < blockLines.length; i++) {
      const m = blockLines[i].match(altRe);
      if (m && altPositions[m[1]] === -1) {
        altPositions[m[1]] = i;
      }
    }

    const hasAllAlts = altPositions.A >= 0 && altPositions.B >= 0 &&
                       altPositions.C >= 0 && altPositions.D >= 0;
    if (!hasAllAlts) continue;

    if (!(altPositions.A < altPositions.B &&
          altPositions.B < altPositions.C &&
          altPositions.C < altPositions.D)) continue;

    const enunciadoLines = blockLines.slice(0, altPositions.A);
    const enunciado = enunciadoLines.join(" ").replace(/\s+/g, " ").trim();

    function altText(startIdx, endIdx) {
      const firstLine = blockLines[startIdx].replace(altRe, "").trim();
      const rest = blockLines.slice(startIdx + 1, endIdx).join(" ");
      return `${firstLine} ${rest}`.replace(/\s+/g, " ").trim();
    }

    if (!questoes.has(qNum)) {
      questoes.set(qNum, {
        enunciado,
        A: altText(altPositions.A, altPositions.B),
        B: altText(altPositions.B, altPositions.C),
        C: altText(altPositions.C, altPositions.D),
        D: altText(altPositions.D, blockLines.length),
      });
    }
  }

  return questoes;
}

// ─── VERIFICAÇÃO ──────────────────────────────────────────────────────────────

function verifyQuestoes(questoes, gabaritoMap) {
  const checks = [];

  checks.push({
    name: "Total = 80 questões",
    passed: questoes.length === 80,
    detail: `Encontradas: ${questoes.length}`,
  });

  const badAlts = questoes.filter(
    q => !q.alternativas.A?.trim() || !q.alternativas.B?.trim() ||
         !q.alternativas.C?.trim() || !q.alternativas.D?.trim()
  );
  checks.push({
    name: "4 alternativas não-vazias em todas",
    passed: badAlts.length === 0,
    detail: badAlts.length === 0 ? "OK" : `Q${badAlts.map(q => q.num).join(", Q")}`,
  });

  const q1 = questoes.find(q => q.num === 1);
  const q1text = q1 ? (q1.enunciado + " " + Object.values(q1.alternativas).join(" ")) : "";
  const q1Legible = q1text.length > 50 && /[aeiouáéíóúãõ]/i.test(q1text);
  checks.push({
    name: "Q1 com enunciado legível (>50 chars, tem vogais acentuadas)",
    passed: q1Legible,
    detail: q1 ? `"${q1text.slice(0, 100)}..."` : "Q1 não encontrada",
  });

  const validGab = new Set(["A", "B", "C", "D", "ANULADA"]);
  const badGab = questoes.filter(q => !validGab.has(q.gabarito));
  checks.push({
    name: "Gabarito válido em todas",
    passed: badGab.length === 0,
    detail: badGab.length === 0 ? "OK" : `Sem gabarito: Q${badGab.map(q => `${q.num}=${q.gabarito}`).join(", Q")}`,
  });

  const gabSize = gabaritoMap.size;
  checks.push({
    name: `Gabarito mapeou ${gabSize} questões (>=70)`,
    passed: gabSize >= 70,
    detail: `${gabSize} questões no gabarito`,
  });

  const anuladas = questoes.filter(q => q.gabarito === "ANULADA");
  if (anuladas.length > 0) {
    checks.push({
      name: `ANULADAs (informativo)`,
      passed: true,
      detail: `${anuladas.length}: Q${anuladas.map(q => q.num).join(", Q")}`,
    });
  }

  const criticalChecks = checks.filter(c => !c.name.startsWith("ANULADA"));
  const ok = criticalChecks.every(c => c.passed);
  return { ok, checks };
}

// ─── MAIN POR EDIÇÃO ──────────────────────────────────────────────────────────

async function processEdition(edicaoNum) {
  const config = EDITION_CONFIG[edicaoNum];
  if (!config) throw new Error(`Edição ${edicaoNum} não configurada. Adicione em EDITION_CONFIG.`);

  const rawDir = path.join(SEAGATE_BASE, "raw");
  // Usar diretório OCR por edição para evitar conflitos em execuções paralelas
  const ocrDir = path.join(SEAGATE_BASE, "ocr", `ed${edicaoNum}`);
  const structuredDir = path.join(SEAGATE_BASE, "structured");
  const localStructuredDir = path.join(PROJECT_ROOT, "data/structured");

  const provaPdf = path.join(rawDir, `oab${edicaoNum}_tipo1.pdf`);
  const gabaritoPdf = path.join(rawDir, `oab${edicaoNum}_gabarito.pdf`);
  const outSeagate = path.join(structuredDir, `oab${edicaoNum}_tipo1.json`);
  const outLocal = path.join(localStructuredDir, `oab${edicaoNum}_tipo1.json`);

  const startTime = Date.now();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Parser FGV OAB — ${edicaoNum}º EOU Tipo 1`);
  console.log(`${"═".repeat(60)}\n`);

  // Pré-requisitos
  if (!fs.existsSync(provaPdf)) throw new Error(`PDF prova não encontrado: ${provaPdf}`);
  if (!fs.existsSync(gabaritoPdf)) throw new Error(`PDF gabarito não encontrado: ${gabaritoPdf}`);

  requireTool("pdftoppm", "which pdftoppm");
  requireTool("tesseract", "which tesseract");
  requireTool("pdftotext", "which pdftotext");

  ensureDir(ocrDir);
  ensureDir(structuredDir);
  ensureDir(localStructuredDir);

  // Limpar PNGs velhos do ocrDir (segurança)
  const oldPngs = fs.readdirSync(ocrDir).filter(f => f.endsWith(".png"));
  for (const f of oldPngs) {
    try { fs.unlinkSync(path.join(ocrDir, f)); } catch (_) {}
  }

  // Gabarito
  console.log("1. Parseando gabarito...");
  const gabaritoMap = parseGabarito(gabaritoPdf, edicaoNum);
  console.log(`   ${gabaritoMap.size} questões mapeadas`);
  const first10 = Array.from({ length: 10 }, (_, i) => gabaritoMap.get(i + 1) || "?").join(",");
  console.log(`   Primeiros 10: ${first10}\n`);

  if (gabaritoMap.size < 70) {
    throw new Error(`Gabarito insuficiente: apenas ${gabaritoMap.size} questões. Verifique o PDF.`);
  }

  // OCR
  console.log("2. OCR (2 colunas por página)...");
  const ocrStart = Date.now();
  const fullText = await ocrAllPages(provaPdf, config, ocrDir);
  const ocrSecs = ((Date.now() - ocrStart) / 1000).toFixed(1);
  console.log(`   OCR concluído em ${ocrSecs}s\n`);

  // Debug: salvar fullText para diagnóstico
  fs.writeFileSync(`/tmp/oab${edicaoNum}_script_ocr.txt`, fullText, "utf-8");

  // Segmentação
  console.log("3. Segmentando questões...");
  const questaoMap = segmentQuestoes(fullText, edicaoNum);
  console.log(`   ${questaoMap.size} questões segmentadas\n`);

  // Montar output
  console.log("4. Montando JSON...");
  const parseWarnings = [];
  const questoes = [];

  for (let num = 1; num <= 80; num++) {
    const qData = questaoMap.get(num);
    const gabarito = gabaritoMap.get(num);

    if (!qData) {
      parseWarnings.push(`Q${num}: não encontrada no OCR`);
      questoes.push({
        num,
        enunciado: `[NÃO EXTRAÍDO — Q${num}]`,
        alternativas: { A: "", B: "", C: "", D: "" },
        gabarito: gabarito ?? "ERRO_SEM_GABARITO",
      });
      continue;
    }

    if (!gabarito) parseWarnings.push(`Q${num}: sem gabarito`);

    questoes.push({
      num,
      enunciado: qData.enunciado,
      alternativas: { A: qData.A, B: qData.B, C: qData.C, D: qData.D },
      gabarito: gabarito ?? "ERRO_SEM_GABARITO",
    });
  }

  // Verificações
  console.log("5. Verificações:\n");
  const { ok, checks } = verifyQuestoes(questoes, gabaritoMap);

  for (const check of checks) {
    const icon = check.passed ? "✓" : "✗";
    console.log(`   ${icon} ${check.name}`);
    console.log(`     → ${check.detail}`);
  }

  if (parseWarnings.length > 0) {
    console.log("\n   Warnings do parse:");
    for (const w of parseWarnings) console.log(`   ! ${w}`);
  }

  if (!ok) {
    const failed = checks.filter(c => !c.passed).map(c => c.name);
    throw new Error(`Checks falharam:\n${failed.map(f => "  - " + f).join("\n")}`);
  }

  // Salvar
  const totalSecs = ((Date.now() - startTime) / 1000).toFixed(1);

  const output = {
    exame: {
      numero: config.exame_numero,
      ano: config.ano,
      tipo: 1,
      data_aplicacao: config.data_aplicacao,
    },
    questoes,
    _parse_meta: {
      parsed_at: new Date().toISOString(),
      source_pdf: provaPdf,
      gabarito_pdf: gabaritoPdf,
      warnings: parseWarnings,
      engine: "OCR: pdftoppm 300dpi + tesseract -l por (2 colunas)",
      column_split: config.column_split,
      ocr_seconds: parseFloat(ocrSecs),
      total_seconds: parseFloat(totalSecs),
    },
  };

  fs.writeFileSync(outSeagate, JSON.stringify(output, null, 2), "utf-8");
  fs.writeFileSync(outLocal, JSON.stringify(output, null, 2), "utf-8");

  const sizeKb = Math.round(fs.statSync(outSeagate).size / 1024);
  console.log(`\n6. Salvo:`);
  console.log(`   Seagate: ${outSeagate} (${sizeKb} KB)`);
  console.log(`   Local:   ${outLocal}`);
  console.log(`   Tempo total: ${totalSecs}s`);

  const q1 = questoes[0];
  const q1preview = (q1?.enunciado || "").split(/\s+/).slice(0, 15).join(" ");
  console.log(`   Q1 preview: "${q1preview}"`);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  RESULTADO: PASSOU ✓ — ${edicaoNum}º EOU pronto`);
  console.log(`${"═".repeat(60)}\n`);

  return outSeagate;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const edicaoArg = parseInt(process.argv[2], 10);
if (!edicaoArg || edicaoArg < 1 || edicaoArg > 60) {
  console.error("Uso: node parse-fgv-edition.mjs <numero_edicao>");
  console.error("  ex: node parse-fgv-edition.mjs 43");
  process.exit(1);
}

processEdition(edicaoArg)
  .then(outPath => {
    console.log(`\nJSON gerado: ${outPath}`);
  })
  .catch(err => {
    console.error("\nERRO FATAL:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
