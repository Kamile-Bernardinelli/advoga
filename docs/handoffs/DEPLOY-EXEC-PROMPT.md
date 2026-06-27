Orion, EXECUTE o deploy do ADVOGA pro cloud da Kamile (Supabase + Vercel) e VERIFIQUE no ar. Tudo já foi preparado numa sessão anterior — sua tarefa é VERIFICAR + EXECUTAR + CONFIRMAR. Trabalhe em /Users/admin/code/apps/_active/advoga. Anti-chute: verifique cada passo com número real, nunca declare pronto sem evidência.

═══ CONTEXTO (já feito) ═══
• App Next.js 16 + Supabase + Vercel, single-user (Kamile). Drop 1 + 1.5 + 2 prontos, em `master`, 65/65 testes, build verde. Roda local; falta PUBLICAR pra Kamile acessar.
• As 6 keys da Kamile (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, VERCEL_TOKEN, GITHUB_TOKEN) JÁ estão no `.env` (gitignored). Projeto Supabase dela: ref `wxuvcttiohpakyvjbkvy`, região us-west-2.
• Pré-voo já passou na sessão anterior: DB conecta (senha certa), Supabase REST 200, GitHub 200, Vercel 200.
• Script de deploy completo já existe: `scripts/deploy/run-deploy.sh` (GitHub → migrate → Vercel, ordem segura, anti-leak, SEM wipe).
• `scripts/deploy/migrate-to-cloud.mjs` auditado; tags em `data/tags/all-tags.json` (640, 8 edições; ed40 excluída de propósito — não re-tagueia).

═══ EXECUÇÃO (nesta ordem) ═══

1) PRÉ-VOO (reconfirme as keys; shell é zsh, indirect = ${(P)k}; NÃO imprima valores):
```
cd /Users/admin/code/apps/_active/advoga
set -a; . ./.env 2>/dev/null; set +a
for k in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY DATABASE_URL VERCEL_TOKEN GITHUB_TOKEN; do v=${(P)k}; [ -z "$v" ] && echo "$k ✗VAZIO" || echo "$k ✓(${#v})"; done
psql "$DATABASE_URL" -X -t -c "select 'DB ✓ '||current_database()"
curl -s -o /dev/null -w "Supabase REST %{http_code}\n" "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" --max-time 15
curl -s -o /dev/null -w "GitHub %{http_code}\n" -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user --max-time 15
curl -s -o /dev/null -w "Vercel %{http_code}\n" -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v2/user --max-time 15
```
Espera: 6 keys ✓, DB ✓, e três 200. Se algo falhar, PARE e avise o Marcos.

2) EXECUTE O DEPLOY: rode `bash scripts/deploy/run-deploy.sh`. Ele faz, parando na 1ª falha:
   a. GitHub — confirma `.env` gitignored, cria repo PRIVADO `advoga` + push (preserva o código ANTES de qualquer wipe).
   b. Supabase — `migrate-to-cloud` (9 migrations + 640 questões + tags offline + Kamile + metas → cloud dela) + verificação de contagem.
   c. Vercel — cria projeto `advoga`, seta as 3 env vars de produção (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY), deploy → cospe a URL.
   ⚠️ SE O CLASSIFICADOR DE SEGURANÇA BLOQUEAR (push/deploy autônomo = "exfiltração de código"): NÃO insista. Peça ao Marcos pra rodar ele mesmo `! bash scripts/deploy/run-deploy.sh` (o prefixo `!` autoriza na sessão e a saída volta pra você), OU pra adicionar uma regra de permissão Bash nas settings. Depois você verifica normalmente.

3) VERIFIQUE NO AR (playwright/browser — NÃO confie só no build):
   • Abra a URL de produção; login Kamile: `kamile@advoga.local` / `advoga-dev-2026`.
   • Cheque `/plano` e `/cronograma` renderizando logado (zero 500).
   • Inicie uma prova em `/teste` → confirme questões reais aparecendo SEM gabarito (a view `questoes_prova` não expõe `gabarito`).
   • Confirme via SQL no cloud: `psql "$DATABASE_URL" -X -t -c "select count(*),count(materia_id) from questoes"` = 640/640.

4) REPORTE ao Marcos: URL do repo GitHub · contagem do migrate (640/640) · URL de produção do Vercel · resultado da verificação no ar (prints).

5) WIPE (SÓ depois de TUDO verde + OK EXPLÍCITO do Marcos): aí sim libera a máquina —
   `supabase stop` (para os containers; volume persiste) e, se o Marcos autorizar a limpeza pesada, remover o volume + `docker system prune`. Pré-condições inegociáveis antes de apagar QUALQUER coisa: (a) push no GitHub confirmado, (b) cloud verificado no ar, (c) Marcos disse "pode apagar". NUNCA antes disso.

═══ REGRAS ═══
Secrets só no `.env`, nunca no chat. Só @devops dá push/deploy. NUNCA `supabase db reset` local (dados vieram por script). NÃO apague nada sem verificação no ar + OK explícito. O deploy é idempotente — se falhar no meio, conserte pelo output e re-rode.
