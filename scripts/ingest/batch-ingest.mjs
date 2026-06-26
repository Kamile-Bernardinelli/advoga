#!/usr/bin/env node
/**
 * batch-ingest.mjs — Pipeline completo para múltiplas edições OAB
 *
 * Uso: node scripts/ingest/batch-ingest.mjs [edicoes...]
 *   ex: node scripts/ingest/batch-ingest.mjs 43 44 45
 *   ou: node scripts/ingest/batch-ingest.mjs  (usa lista default)
 *
 * Pipeline por edição:
 *   1. Download prova + gabarito (se não existir)
 *   2. parse-fgv-edition.mjs → JSON estruturado
 *   3. load-exam.mjs → banco de dados
 *   4. Verificação final via SQL
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../");
const SEAGATE_BASE = "/Volumes/Seagate 1/advoga-ingest";
const RAW_DIR = path.join(SEAGATE_BASE, "raw");
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// ─── DADOS DAS EDIÇÕES (do oab-editions.json) ────────────────────────────────

const EDITIONS = {
  37: {
    prova_url: "https://oab.fgv.br/arq/640/641232_Advogado(EOU)%20Tipo%201.pdf",
    gabarito_url: "https://s.oab.org.br/arquivos/2023/03/6482394e-c6e3-4553-9efe-6ce8371f9a90.pdf",
  },
  38: {
    prova_url: "https://s.oab.org.br/arquivos/2023/07/1bf68b8c-a8da-4bbe-a1ec-2134353ad2e6.pdf",
    gabarito_url: "https://oab.fgv.br/arq/641/77411_GABARITOS%20DEFINITIVOS_XXXVIII_EXAME_DE_ORDEM_20230724.pdf",
  },
  39: {
    prova_url: "https://s.oab.org.br/arquivos/2023/11/8340b3e9-4337-4351-929c-3dcfd772e54a.pdf",
    gabarito_url: "https://oab.fgv.br/arq/642/86039_OABXXXIX%20definitivo%20v20231205.pdf",
  },
  40: {
    prova_url: "https://oab.fgv.br/arq/643/341069_ADVOGADO%20OAB(CNS01)%20Tipo%201.pdf",
    gabarito_url: "https://s.oab.org.br/arquivos/2024/04/b64dd2cd-94fb-47fa-90b6-459e2d375a69.pdf",
  },
  41: {
    prova_url: "https://oab.fgv.br/arq/644/552356_ADVOGADO%20OAB(CNS01)%20Tipo%201%20(1).pdf",
    gabarito_url: "https://oab.fgv.br/arq/644/255635_OAB41%20Gabaritos%20para%20publica%C3%A7%C3%A3o%20-%20v20240728.pdf",
  },
  43: {
    prova_url: "https://s.oab.org.br/arquivos/2025/04/145104f9-1301-453d-9079-3d5af4f8e60a.pdf",
    gabarito_url: "https://oab.fgv.br/arq/646/410294_OAB43%20Gabaritos%20para%20publica%C3%A7%C3%A3o%20-%20V20250430.pdf",
  },
  44: {
    prova_url: "https://s.oab.org.br/arquivos/2025/08/fda2cc49-fbbd-4893-9b75-0f61c177cd5d.pdf",
    gabarito_url: "https://s.oab.org.br/arquivos/2025/09/b6fb7503-e2cf-4e9b-8b0a-9b822df591fe.pdf",
  },
  45: {
    prova_url: "https://oab.fgv.br/arq/648/405589_ADVOGADO%20OAB(CNS01)%20Tipo%201.pdf",
    gabarito_url: "https://oab.fgv.br/arq/648/85707_OAB45%20Gabaritos%20para%20publica%C3%A7%C3%A3o%20-%20v3.pdf",
  },
  46: {
    prova_url: "https://s.oab.org.br/arquivos/2026/05/b5f2a4bd-8885-4f42-909f-a2ecac329dab.pdf",
    gabarito_url: "https://s.oab.org.br/arquivos/2026/05/0662d6ed-01a3-4ee5-905f-a6704d72992b.pdf",
  },
};

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  const result = spawnSync("bash", ["-c", cmd], {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    ...opts,
  });
  if (result.error) throw result.error;
  return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status };
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size > 10000) {
        console.log(`   Já existe (${Math.round(stat.size / 1024)} KB): ${path.basename(destPath)}`);
        return resolve();
      }
      fs.unlinkSync(destPath); // Remover arquivo truncado
    }

    console.log(`   Baixando: ${url}`);
    const file = fs.createWriteStream(destPath);
    const proto = url.startsWith("https") ? https : http;

    const doRequest = (u, depth = 0) => {
      if (depth > 5) return reject(new Error("Too many redirects"));
      proto.get(u, { timeout: 120000 }, res => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const loc = res.headers.location;
          console.log(`   Redirect → ${loc}`);
          const newProto = loc.startsWith("https") ? https : http;
          newProto.get(loc, { timeout: 120000 }, res2 => {
            if (res2.statusCode !== 200) {
              return reject(new Error(`HTTP ${res2.statusCode} no redirect para ${loc}`));
            }
            res2.pipe(file);
            file.on("finish", () => {
              file.close();
              const stat = fs.statSync(destPath);
              console.log(`   OK: ${Math.round(stat.size / 1024)} KB`);
              resolve();
            });
          }).on("error", reject);
        } else if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          reject(new Error(`HTTP ${res.statusCode} para ${u}`));
        } else {
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            const stat = fs.statSync(destPath);
            console.log(`   OK: ${Math.round(stat.size / 1024)} KB`);
            resolve();
          });
          res.on("error", reject);
        }
      }).on("error", err => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    };

    doRequest(url);
  });
}

// ─── PIPELINE POR EDIÇÃO ──────────────────────────────────────────────────────

async function processEdition(edicaoNum) {
  const edition = EDITIONS[edicaoNum];
  if (!edition) throw new Error(`Edição ${edicaoNum} não tem URLs configuradas`);

  const provaPdf = path.join(RAW_DIR, `oab${edicaoNum}_tipo1.pdf`);
  const gabaritoPdf = path.join(RAW_DIR, `oab${edicaoNum}_gabarito.pdf`);
  const structuredJson = path.join(SEAGATE_BASE, "structured", `oab${edicaoNum}_tipo1.json`);

  console.log(`\n${"─".repeat(60)}`);
  console.log(`EDIÇÃO ${edicaoNum}`);
  console.log(`${"─".repeat(60)}`);

  // Passo 1: Download
  console.log("\n[1] Download PDFs...");
  ensureDir(RAW_DIR);
  await downloadFile(edition.prova_url, provaPdf);
  await downloadFile(edition.gabarito_url, gabaritoPdf);

  // Passo 2: Parse OCR
  console.log("\n[2] Parse OCR...");
  const parseResult = run(
    `node "${path.join(__dirname, "parse-fgv-edition.mjs")}" ${edicaoNum}`,
    { maxBuffer: 50 * 1024 * 1024 }
  );
  process.stdout.write(parseResult.stdout);
  if (parseResult.stderr) process.stderr.write(parseResult.stderr);
  if (parseResult.status !== 0) {
    throw new Error(`parse-fgv-edition.mjs falhou com status ${parseResult.status}`);
  }

  // Passo 3: Verificar JSON gerado
  if (!fs.existsSync(structuredJson)) {
    throw new Error(`JSON não gerado: ${structuredJson}`);
  }
  const jsonData = JSON.parse(fs.readFileSync(structuredJson, "utf-8"));
  if (!jsonData.questoes || jsonData.questoes.length !== 80) {
    throw new Error(`JSON inválido: ${jsonData.questoes?.length ?? 0} questões (esperado 80)`);
  }

  // Passo 4: Load no banco
  console.log("\n[3] Carregando no banco...");
  const loadResult = run(
    `node "${path.join(__dirname, "load-exam.mjs")}" "${structuredJson}" "${DB_URL}"`,
    { maxBuffer: 5 * 1024 * 1024 }
  );
  process.stdout.write(loadResult.stdout);
  if (loadResult.stderr) process.stderr.write(loadResult.stderr);
  if (loadResult.status !== 0) {
    throw new Error(`load-exam.mjs falhou com status ${loadResult.status}`);
  }

  return { edicao: edicaoNum, status: "ok", questoes: 80 };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const DEFAULT_EDITIONS = [37, 38, 39, 40, 41, 43, 44, 45, 46];

  const args = process.argv.slice(2).map(Number).filter(n => n > 0);
  const toProcess = args.length > 0 ? args : DEFAULT_EDITIONS;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  OAB Batch Ingest — Edições: ${toProcess.join(", ")}`);
  console.log(`${"═".repeat(60)}`);

  ensureDir(RAW_DIR);
  ensureDir(path.join(SEAGATE_BASE, "structured"));
  ensureDir(path.join(SEAGATE_BASE, "ocr"));

  const results = [];
  const skipped = [];

  for (const edicaoNum of toProcess) {
    try {
      const result = await processEdition(edicaoNum);
      results.push(result);
      console.log(`\n✓ Edição ${edicaoNum}: SUCESSO (80 questões carregadas)`);
    } catch (err) {
      console.error(`\n✗ Edição ${edicaoNum}: FALHOU — ${err.message}`);
      skipped.push({ edicao: edicaoNum, motivo: err.message });
    }
  }

  // Verificação final via SQL
  console.log(`\n${"═".repeat(60)}`);
  console.log("VERIFICAÇÃO FINAL NO BANCO:");
  const sqlResult = run(
    `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "select e.edicao, count(*) as total from questoes q join exames e on e.id=q.exame_id group by e.edicao order by e.edicao;"`
  );
  console.log(sqlResult.stdout);
  if (sqlResult.stderr) console.log(sqlResult.stderr);

  // Resumo
  console.log("RESUMO:");
  console.log(`  OK:      ${results.map(r => r.edicao).join(", ") || "(nenhuma)"}`);
  console.log(`  SKIPPED: ${skipped.map(s => s.edicao).join(", ") || "(nenhuma)"}`);

  if (skipped.length > 0) {
    console.log("\nDetalhes dos SKIPPED:");
    for (const s of skipped) {
      console.log(`  Ed.${s.edicao}: ${s.motivo.slice(0, 200)}`);
    }
  }

  console.log(`${"═".repeat(60)}\n`);

  if (skipped.length > 0) process.exit(1);
}

main().catch(err => {
  console.error("ERRO FATAL:", err.message);
  process.exit(1);
});
