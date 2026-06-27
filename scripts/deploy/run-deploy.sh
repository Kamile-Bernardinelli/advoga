#!/usr/bin/env bash
# ADVOGA · Deploy completo (ordem segura) — RODE VOCÊ MESMO via:  ! bash scripts/deploy/run-deploy.sh
# Faz: 1) GitHub (preserva o código)  2) Supabase migrate (dados → cloud da Kamile)  3) Vercel (publica)
# Não imprime nenhum valor de segredo. Para na primeira falha (set -e) com marcador da fase.
set -euo pipefail
cd /Users/admin/code/apps/_active/advoga

echo "Pré-checagem de ferramentas..."
for c in git gh vercel node psql; do command -v "$c" >/dev/null || { echo "FALTA o comando: $c — instale antes de rodar."; exit 1; }; done
echo "Carregando .env..."
set -a; . ./.env; set +a

echo ""
echo "═══════════ 1/3 · GITHUB (preservar o código antes de qualquer wipe) ═══════════"
for f in .env .env.local docs/setup/deploy-credentials.html; do
  git check-ignore -q "$f" || { echo "ABORTADO: $f NÃO está gitignored — risco de vazar segredo."; exit 1; }
done
export GH_TOKEN="$GITHUB_TOKEN"
git add -A
git commit -m "chore: pre-deploy snapshot" || echo "(nada novo a commitar)"
if git remote get-url origin >/dev/null 2>&1; then
  echo "remote 'origin' já existe → push"
  git push -u origin master --force
elif gh repo view advoga >/dev/null 2>&1; then
  REPO_URL="$(gh repo view advoga --json url -q .url).git"
  echo "repo 'advoga' já existe na conta → set origin + push (force: popula o repo de deploy)"
  git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"
  git push -u origin master --force
else
  echo "criando repo PRIVADO 'advoga' + push"
  gh repo create advoga --private --source=. --remote=origin --push
fi
echo "→ repo: $(gh repo view --json url -q .url 2>/dev/null || echo '??')"
if git ls-files | grep -qE '(^|/)\.env'; then echo "ABORTADO: um arquivo .env foi versionado!"; exit 1; fi
echo "✓ nenhum .env versionado"

echo ""
echo "═══════════ 2/3 · SUPABASE (migrate dos dados → cloud da Kamile) ═══════════"
CLOUD_DATABASE_URL="$DATABASE_URL" CLOUD_SUPABASE_URL="$SUPABASE_URL" CLOUD_SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  node scripts/deploy/migrate-to-cloud.mjs
echo "→ verificação no cloud:"
psql "$DATABASE_URL" -X -t -c "select '  questoes='||count(*)||' tagueadas='||count(materia_id) from questoes"
psql "$DATABASE_URL" -X -t -c "select '  materias='||(select count(*) from materias)||' subtemas='||(select count(*) from subtemas)||' metas='||(select count(*) from metas_estudo)"

echo ""
echo "═══════════ 3/3 · VERCEL (publicar o app) ═══════════"
set_env() {
  local name="$1" val="$2"
  vercel env rm "$name" production --yes --token="$VERCEL_TOKEN" >/dev/null 2>&1 || true
  printf '%s' "$val" | vercel env add "$name" production --token="$VERCEL_TOKEN" >/dev/null 2>&1 && echo "✓ env $name" || echo "✗ falhou env $name"
}
echo "linkando/criando projeto 'advoga'..."
vercel link --yes --project advoga --token="$VERCEL_TOKEN" 2>/dev/null || vercel link --yes --token="$VERCEL_TOKEN" || true
echo "setando env vars de produção..."
set_env NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL"
set_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
set_env SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
echo "deployando produção (pode levar 1-3 min)..."
vercel deploy --prod --yes --token="$VERCEL_TOKEN"

echo ""
echo "═══════════ ✅ FLUXO CONCLUÍDO ═══════════"
echo "Copie a URL de produção (linha acima, https://advoga-...vercel.app) e me mande pra eu verificar no ar."
