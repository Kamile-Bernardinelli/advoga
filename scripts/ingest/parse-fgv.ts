/**
 * parse-fgv.ts — Parser de provas FGV da OAB 1ª fase
 *
 * Roda com: npx tsx scripts/ingest/parse-fgv.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PONTOS DE AJUSTE POR EDIÇÃO (ler antes de adaptar para nova edição):
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. ENCODING DA FONTE CALIBRI (FRAGILIDADE PRINCIPAL):
 *    A FGV embute fontes Calibri/Calibri-Bold sem ToUnicode map.
 *    O PyMuPDF extrai os glyph IDs como char Unicode usando heurística, produzindo
 *    texto "quebrado" mas CONSISTENTE entre edições que usam a mesma versão do Word.
 *
 *    Mapeamento verificado para o 42º EOU:
 *      Dígitos: U+03EC (Ϭ)=0, U+03ED (ϭ)=1, ..., U+03F5 (ϵ)=9
 *      Marcadores de alternativa: \x04=A, \x11=B, \x12=C, \x18=D
 *      Parêntese ')': U+037F (Ϳ)
 *
 *    SE uma nova edição produzir texto diferente (ex: ϭ deixar de ser "1"),
 *    REINSPECIONAR o PDF com PyMuPDF e recalibrar DIGIT_CHARS e ALT_CHARS.
 *    Comando de diagnóstico:
 *      python3 -c "import fitz; doc=fitz.open('prova.pdf'); p=doc[1]; print(repr(p.get_text('text')[:200]))"
 *
 * 2. SEPARAÇÃO DE COLUNAS POR COORDENADA X (FRAGILIDADE SECUNDÁRIA):
 *    O parser divide cada página na posição X = 49% da largura da página.
 *    Para provas com layout diferente (ex: 1 coluna ou 3 colunas), ajustar
 *    a constante COLUMN_SPLIT_RATIO.
 *
 * 3. FORMATO DO GABARITO:
 *    O arquivo de gabarito tem linhas de números (1..20) seguidas de respostas (A/B/C/D).
 *    SE a FGV mudar o formato do gabarito, ajustar parseGabarito().
 *
 * 4. QUESTÕES ANULADAS:
 *    Gabarito marca com "*" ou campo vazio. Parser converte para "ANULADA".
 *    Verificar o formato real no gabarito de cada edição.
 *
 * 5. ENUNCIADO INCOMPLETO:
 *    O enunciado capturado é a janela de 500 chars ANTES das alternativas.
 *    Questões com enunciado muito longo (texto de referência) podem ter o início
 *    cortado. Isso é esperado e aceitável para o banco de dados.
 *
 * 6. PÁGINAS PROCESSADAS:
 *    Por default, processa páginas 2 a 19 do PDF (índices 1..18).
 *    Página 1 = capa, página 20 = gabarito/correspondência.
 *    AJUSTAR se o PDF tiver número diferente de páginas de conteúdo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as os from "os";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface Alternativas {
  A: string;
  B: string;
  C: string;
  D: string;
}

interface Questao {
  num: number;
  enunciado: string;
  alternativas: Alternativas;
  gabarito: string; // "A" | "B" | "C" | "D" | "ANULADA"
}

interface ProvaStructured {
  exame: {
    numero: number;
    ano: number;
    tipo: number;
    data_aplicacao: string;
  };
  questoes: Questao[];
  _parse_meta: {
    parsed_at: string;
    source_pdf: string;
    gabarito_file: string;
    warnings: string[];
    engine: string;
  };
}

// ─── PARSER DO GABARITO ───────────────────────────────────────────────────────

/**
 * Extrai o gabarito do Tipo especificado do arquivo de gabarito FGV.
 *
 * Formato esperado:
 *   42º EXAME DE ORDEM UNIFICADO - PROVA TIPO 1
 *    1    2    3  ...  20
 *   D    B    D  ...  D
 *   ...
 */
function parseGabarito(
  gabaritoContent: string,
  tipo: number
): Map<number, string> {
  const gabarito = new Map<number, string>();

  const tipoLabel = `PROVA TIPO ${tipo}`;
  const tipoIdx = gabaritoContent.indexOf(tipoLabel);
  if (tipoIdx === -1) {
    throw new Error(`Gabarito: não encontrou seção "${tipoLabel}"`);
  }

  const nextTipoIdx = gabaritoContent.indexOf("PROVA TIPO", tipoIdx + 10);
  const section =
    nextTipoIdx === -1
      ? gabaritoContent.slice(tipoIdx)
      : gabaritoContent.slice(tipoIdx, nextTipoIdx);

  const lines = section.split("\n").filter((l) => l.trim());

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Linha de números: somente dígitos e espaços, múltiplos itens
    if (/^\d+(\s+\d+)*$/.test(line)) {
      const nums = line.split(/\s+/).map(Number);
      if (nums.every((n) => n >= 1 && n <= 80) && nums.length > 1) {
        if (i + 1 < lines.length) {
          const ansLine = lines[i + 1].trim();
          const answers = ansLine.split(/\s+/);
          if (answers.length === nums.length) {
            for (let j = 0; j < nums.length; j++) {
              const ans = answers[j].toUpperCase();
              gabarito.set(
                nums[j],
                ans === "*" || ans === "" ? "ANULADA" : ans
              );
            }
          }
          i += 2;
          continue;
        }
      }
    }
    i++;
  }

  return gabarito;
}

// ─── EXTRAÇÃO VIA PYTHON/PYMUPDF ─────────────────────────────────────────────

/**
 * Script Python inline que extrai as questões usando PyMuPDF.
 * Produz JSON no stdout.
 *
 * Estratégia:
 * 1. Para cada página (2..19), extrai chars com coordenadas X,Y.
 * 2. Divide em coluna esquerda (x < 49% da largura) e direita (x >= 49%).
 * 3. Em cada coluna, localiza grupos de 4 alternativas (A→B→C→D).
 * 4. Para cada grupo, captura o enunciado (500 chars antes de A) e o texto de cada alternativa.
 * 5. Identifica o número da questão a partir de sequências de dígitos FGV isoladas.
 */
const PYTHON_EXTRACTOR = String.raw`
import fitz, re, json, sys

PDF_PATH = sys.argv[1]
PAREN = 'Ϳ'  # U+037F
ALT_MARKERS = {'\x04': 'A', '\x11': 'B', '\x12': 'C', '\x18': 'D'}
DIGITS = {chr(0x03EC + i): str(i) for i in range(10)}
DIGIT_CHARS = set(DIGITS.keys())
COLUMN_SPLIT_RATIO = 0.49  # Ajustar se o layout mudar

def decode_fgv_num(s):
    digits = ''.join(DIGITS.get(c, '') for c in s if c in DIGIT_CHARS)
    return int(digits) if digits else None

def clean_text(s):
    """Remove control chars, normaliza espaços. Mantém texto raw da fonte FGV."""
    result = []
    for c in s:
        cp = ord(c)
        if cp < 0x20 and c not in ('\n', '\t'):
            result.append(' ')
        elif c == '\x03':  # Separador de palavras no encoding FGV
            result.append(' ')
        else:
            result.append(c)
    return ' '.join(''.join(result).split()).strip()

def extract_from_column(text):
    """Extrai questões de um stream de texto de uma coluna."""
    questoes = {}

    # Encontrar posições dos marcadores de alternativa: [marker][PAREN]
    positions = []
    for i, c in enumerate(text):
        if c in ALT_MARKERS and i + 1 < len(text) and text[i + 1] == PAREN:
            positions.append((i, ALT_MARKERS[c]))

    # Agrupar em blocos A->B->C->D
    groups = []
    i = 0
    while i < len(positions):
        if (i + 3 < len(positions) and
                positions[i][1] == 'A' and positions[i+1][1] == 'B' and
                positions[i+2][1] == 'C' and positions[i+3][1] == 'D'):
            groups.append((positions[i][0], positions[i+1][0],
                          positions[i+2][0], positions[i+3][0]))
            i += 4
        else:
            i += 1

    for g_idx, (posA, posB, posC, posD) in enumerate(groups):
        # Fim do texto D: até próxima questão ou 500 chars
        end_D = (groups[g_idx+1][0] if g_idx + 1 < len(groups)
                 else len(text))
        end_D = min(posD + 500, end_D)

        textA = text[posA + 2:posB]
        textB = text[posB + 2:posC]
        textC = text[posC + 2:posD]
        textD = text[posD + 2:end_D]

        # Enunciado: até 1500 chars antes de A
        pre_text = text[max(0, posA - 1500):posA]

        # Encontrar número da questão: última sequência de dígitos FGV isolada
        q_num = None
        digit_re = re.compile(r'(?:^|\s)([Ϭϭ-ϵ]+)(?:\s|$)')
        for m in reversed(list(digit_re.finditer(pre_text))):
            n = decode_fgv_num(m.group(1))
            if n is not None and 1 <= n <= 80:
                q_num = n
                break

        if q_num is not None:
            questoes[q_num] = {
                'enunciado': clean_text(pre_text[-500:]),
                'A': clean_text(textA),
                'B': clean_text(textB),
                'C': clean_text(textC),
                'D': clean_text(textD[:500]),
            }

    return questoes

doc = fitz.open(PDF_PATH)
all_questoes = {}

for page_idx in range(1, min(20, len(doc))):  # páginas 2..19 (índice 1..18)
    page = doc[page_idx]
    rawdict = page.get_text('rawdict')
    page_width = rawdict['width']
    midpoint = page_width * COLUMN_SPLIT_RATIO

    left_chars, right_chars = [], []

    for block in rawdict['blocks']:
        if block.get('type') != 0:  # apenas blocos de texto
            continue
        for line in block.get('lines', []):
            for span in line.get('spans', []):
                x0, y0 = span['bbox'][0], span['bbox'][1]
                chars = span.get('chars', [])
                if not chars:
                    continue
                char_text = ''.join(c['c'] for c in chars)
                if x0 < midpoint:
                    left_chars.append((y0, x0, char_text))
                else:
                    right_chars.append((y0, x0, char_text))

    left_chars.sort(key=lambda c: (c[0], c[1]))
    right_chars.sort(key=lambda c: (c[0], c[1]))

    left_text = ' '.join(c[2] for c in left_chars)
    right_text = ' '.join(c[2] for c in right_chars)

    for text in [left_text, right_text]:
        for num, q in extract_from_column(text).items():
            if num not in all_questoes:
                all_questoes[num] = q

print(json.dumps(all_questoes))
`;

/**
 * Extrai questões do PDF usando PyMuPDF via subprocess Python.
 */
function extractFromPdf(
  pdfPath: string
): Map<number, Omit<Questao, "gabarito" | "num">> {
  const tmpScript = path.join(os.tmpdir(), "fgv_extractor.py");
  fs.writeFileSync(tmpScript, PYTHON_EXTRACTOR, "utf-8");

  let output: string;
  try {
    output = execSync(`python3 "${tmpScript}" "${pdfPath}"`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    throw new Error(
      `Falha ao executar extrator Python:\n${error.stderr || error.message}`
    );
  }

  const raw = JSON.parse(output) as Record<
    string,
    { enunciado: string; A: string; B: string; C: string; D: string }
  >;

  const result = new Map<number, Omit<Questao, "gabarito" | "num">>();
  for (const [numStr, q] of Object.entries(raw)) {
    const num = parseInt(numStr, 10);
    if (isNaN(num)) continue;
    result.set(num, {
      enunciado: q.enunciado,
      alternativas: { A: q.A, B: q.B, C: q.C, D: q.D },
    });
  }

  return result;
}

// ─── VERIFICAÇÕES ─────────────────────────────────────────────────────────────

interface CheckResult {
  ok: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  warnings: string[];
}

function verifyQuestoes(
  questoes: Questao[],
  expectedCount = 80
): CheckResult {
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
  const warnings: string[] = [];

  // Check 1: Contagem total
  checks.push({
    name: `Total de questões = ${expectedCount}`,
    passed: questoes.length === expectedCount,
    detail: `Encontradas: ${questoes.length}`,
  });

  // Check 2: Questões com exatamente 4 alternativas não-vazias
  const badAlts = questoes.filter(
    (q) => !q.alternativas.A?.trim() || !q.alternativas.B?.trim() ||
           !q.alternativas.C?.trim() || !q.alternativas.D?.trim()
  );
  checks.push({
    name: "Todas as questões com 4 alternativas não-vazias",
    passed: badAlts.length === 0,
    detail:
      badAlts.length === 0
        ? "OK"
        : `Questões com alt vazia: ${badAlts.map((q) => q.num).join(", ")}`,
  });

  // Check 3: Gabarito mapeado para todas
  const validGabaritos = new Set(["A", "B", "C", "D", "ANULADA"]);
  const badGabarito = questoes.filter((q) => !validGabaritos.has(q.gabarito));
  checks.push({
    name: "Todas as questões com gabarito válido",
    passed: badGabarito.length === 0,
    detail:
      badGabarito.length === 0
        ? "OK"
        : `Questões sem gabarito válido: ${badGabarito.map((q) => `Q${q.num}=${q.gabarito}`).join(", ")}`,
  });

  // Check 4: Enunciados não suspeitos (> 20 chars)
  const shortEnunciados = questoes.filter(
    (q) => q.enunciado.trim().length < 20
  );
  if (shortEnunciados.length > 0) {
    warnings.push(
      `Enunciados curtos (< 20 chars): Q${shortEnunciados.map((q) => q.num).join(", Q")}`
    );
  }
  checks.push({
    name: "Nenhum enunciado vazio/truncado (< 20 chars)",
    passed: shortEnunciados.length === 0,
    detail:
      shortEnunciados.length === 0
        ? "OK"
        : `${shortEnunciados.length} questão(ões) com enunciado curto`,
  });

  // Check 5: Contagem de ANULADAs (informativo)
  const anuladas = questoes.filter((q) => q.gabarito === "ANULADA");
  checks.push({
    name: "Contagem de ANULADAs",
    passed: true, // não falha, apenas informa
    detail:
      anuladas.length === 0
        ? "Nenhuma questão anulada"
        : `${anuladas.length} questão(ões) anulada(s): Q${anuladas.map((q) => q.num).join(", Q")}`,
  });

  // Check 6: Sequência contínua 1-N
  const nums = new Set(questoes.map((q) => q.num));
  const missing: number[] = [];
  for (let i = 1; i <= expectedCount; i++) {
    if (!nums.has(i)) missing.push(i);
  }
  checks.push({
    name: `Sequência contínua de questões (1-${expectedCount})`,
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? "OK"
        : `Questões faltando: ${missing.join(", ")}`,
  });

  // ok = todos os checks críticos passam (exceto ANULADA que é informativo)
  const criticalChecks = checks.filter((c) => c.name !== "Contagem de ANULADAs");
  const ok = criticalChecks.every((c) => c.passed);

  return { ok, checks, warnings };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const PROJECT_ROOT = path.resolve(__dirname, "../../");

  // ── Configuração da edição ─────────────────────────────────────────────────
  const META = {
    exame_numero: 42,
    ano: 2024,
    tipo: 1,
    data_aplicacao: "2024-12-01",
  };

  const PROVA_PDF = path.join(PROJECT_ROOT, "data/raw/oab42_tipo1.pdf");
  const GABARITO_FILE = path.join(
    PROJECT_ROOT,
    "data/extracted/oab42_gabarito.txt"
  );
  const OUTPUT_FILE = path.join(
    PROJECT_ROOT,
    "data/structured/oab42_tipo1.json"
  );

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Parser FGV OAB — ${META.exame_numero}º EOU Tipo ${META.tipo}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Verificar prerequisitos ────────────────────────────────────────────────
  console.log("1. Verificando arquivos e dependências...");

  if (!fs.existsSync(PROVA_PDF)) {
    throw new Error(`PDF de prova não encontrado: ${PROVA_PDF}`);
  }
  if (!fs.existsSync(GABARITO_FILE)) {
    throw new Error(`Arquivo de gabarito não encontrado: ${GABARITO_FILE}`);
  }

  // Verificar PyMuPDF
  try {
    execSync("python3 -c 'import fitz'", { stdio: "ignore" });
  } catch {
    throw new Error(
      "PyMuPDF não instalado. Instalar com: pip3 install pymupdf --break-system-packages"
    );
  }

  console.log(`   PDF: ${path.basename(PROVA_PDF)}`);
  console.log(`   Gabarito: ${path.basename(GABARITO_FILE)}\n`);

  // ── Parsear gabarito ───────────────────────────────────────────────────────
  console.log("2. Parseando gabarito...");
  const gabaritoContent = fs.readFileSync(GABARITO_FILE, "utf-8");
  const gabaritoMap = parseGabarito(gabaritoContent, META.tipo);
  console.log(
    `   Gabarito do Tipo ${META.tipo}: ${gabaritoMap.size} questões mapeadas\n`
  );

  if (gabaritoMap.size !== 80) {
    console.warn(
      `   ATENÇÃO: Esperado 80 questões no gabarito, encontrado ${gabaritoMap.size}`
    );
  }

  // ── Extrair questões do PDF ────────────────────────────────────────────────
  console.log("3. Extraindo questões do PDF via PyMuPDF...");
  console.log("   (separação por coordenada X + marcadores de alternativa)\n");

  const questaoMap = extractFromPdf(PROVA_PDF);
  console.log(`   Blocos de questões extraídos: ${questaoMap.size}\n`);

  // ── Montar questões completas ──────────────────────────────────────────────
  console.log("4. Montando questões com gabarito...");

  const parseWarnings: string[] = [];
  const questoes: Questao[] = [];

  for (let num = 1; num <= 80; num++) {
    const qData = questaoMap.get(num);
    const gabarito = gabaritoMap.get(num);

    if (!qData) {
      parseWarnings.push(`Q${num}: não encontrada na extração do PDF`);
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
      alternativas: qData.alternativas,
      gabarito: gabarito ?? "ERRO_SEM_GABARITO",
    });
  }

  questoes.sort((a, b) => a.num - b.num);

  // ── Verificações ───────────────────────────────────────────────────────────
  console.log("5. Verificações...\n");

  const { ok, checks, warnings: checkWarnings } = verifyQuestoes(questoes);

  for (const check of checks) {
    const icon = check.passed ? "✓" : "✗";
    console.log(`   ${icon} ${check.name}`);
    console.log(`     → ${check.detail}`);
  }

  if (checkWarnings.length > 0) {
    console.log("\n   Avisos:");
    for (const w of checkWarnings) {
      console.log(`   ⚠ ${w}`);
    }
  }

  if (parseWarnings.length > 0) {
    console.log("\n   Warnings do parse:");
    for (const w of parseWarnings) {
      console.log(`   ⚠ ${w}`);
    }
  }

  console.log();

  // ── Construir JSON final ───────────────────────────────────────────────────
  const output: ProvaStructured = {
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
      gabarito_file: GABARITO_FILE,
      warnings: [...parseWarnings, ...checkWarnings],
      engine: "PyMuPDF (fitz) + coordenadas XY",
    },
  };

  // ── Salvar JSON ────────────────────────────────────────────────────────────
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");

  const fileSizekB = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);
  console.log(`6. Output salvo em: ${OUTPUT_FILE}`);
  console.log(`   Tamanho: ${fileSizekB} KB\n`);

  // ── Status final ───────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════");
  if (ok) {
    console.log("  RESULTADO: TODOS OS CHECKS PASSARAM ✓");
  } else {
    console.log("  RESULTADO: CHECKS FALHARAM ✗ — ver warnings acima");
    process.exit(1);
  }
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\nERRO FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
