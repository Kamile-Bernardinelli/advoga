#!/usr/bin/env node
/**
 * scripts/seed-user.mjs
 * Cria a usuária Kamile no Supabase Auth local via Admin API (service_role).
 * Idempotente: se o email já existe, não falha.
 *
 * Uso:
 *   node scripts/seed-user.mjs
 *
 * Requer:
 *   NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lê .env.local manualmente (sem dotenv como dep)
function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    const env = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.");
  console.error("Verifique .env.local no root do projeto.");
  process.exit(1);
}

const USER_EMAIL = "kamile@advoga.local";
const USER_PASSWORD = "advoga-dev-2026";

async function seedUser() {
  console.log(`[seed-user] URL: ${SUPABASE_URL}`);
  console.log(`[seed-user] Tentando criar/verificar usuária: ${USER_EMAIL}`);

  // Verifica se o usuário já existe via Admin API
  const listRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!listRes.ok) {
    const body = await listRes.text();
    console.error(`[seed-user] Erro ao listar usuários: ${listRes.status} ${body}`);
    process.exit(1);
  }

  const listData = await listRes.json();
  const users = listData.users || [];
  const existing = users.find((u) => u.email === USER_EMAIL);

  if (existing) {
    console.log(`[seed-user] Usuária já existe: ${USER_EMAIL} (id: ${existing.id})`);
    console.log(`[seed-user] Idempotente — nenhuma ação necessária.`);
    return existing.id;
  }

  // Cria a usuária via Admin API
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: USER_EMAIL,
      password: USER_PASSWORD,
      email_confirm: true, // confirma email automaticamente (sem verificação)
      user_metadata: {
        nome: "Kamile",
        role: "candidata_oab",
      },
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    console.error(`[seed-user] Erro ao criar usuária: ${createRes.status} ${body}`);
    process.exit(1);
  }

  const user = await createRes.json();
  console.log(`[seed-user] Usuária criada com sucesso!`);
  console.log(`  email: ${USER_EMAIL}`);
  console.log(`  senha: ${USER_PASSWORD}`);
  console.log(`  id:    ${user.id}`);
  return user.id;
}

seedUser()
  .then((id) => {
    console.log(`[seed-user] DONE — user_id: ${id}`);
  })
  .catch((err) => {
    console.error("[seed-user] FALHA:", err);
    process.exit(1);
  });
