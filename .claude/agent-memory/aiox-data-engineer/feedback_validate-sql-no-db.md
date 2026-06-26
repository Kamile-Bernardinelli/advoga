---
name: validate-sql-no-db
description: How to truly validate Supabase migrations when no DB server is running — throwaway local PG cluster + auth stubs.
metadata:
  type: feedback
---

When asked to WRITE (not apply) migrations and no DB is up, validate against a real engine
anyway via a disposable local Postgres cluster — far stronger than eyeballing syntax.

**Why:** catches enum/trigger/view/RLS errors that a visual read misses; the mission only
forbids touching the *project* DB, not spinning a throwaway one. macOS has psql 16 +
supabase CLI installed at /usr/local/bin.

**How to apply:**
1. `initdb -D $TMP/data -U postgres --auth=trust`; start with
   `pg_ctl ... -o "-k $SOCK -p 54399 -c listen_addresses=''"` (unix socket, no TCP).
2. Create Supabase-equivalent stubs FIRST (the platform provides these): `auth` schema,
   `auth.users(id uuid pk)`, `auth.uid()` reading `request.jwt.claims->>'sub'`, and roles
   `anon`/`authenticated`/`service_role`.
3. Apply migrations with `psql -v ON_ERROR_STOP=1 -f ...`; a clean COMMIT = pass.
4. Re-run to prove idempotency. Seed synthetic rows to test triggers, the volume gate
   flip, cross-axis, and RLS isolation (SET ROLE authenticated + set_config jwt.claims).
5. Tear down: `pg_ctl stop -m fast` + `rm -rf $TMP`.

Confirmed working for the Advoga EP-0 schema (2026-06-21): all 3 migrations applied,
11 tables / 4 views / 6 enums, RLS isolation positive+negative verified.
