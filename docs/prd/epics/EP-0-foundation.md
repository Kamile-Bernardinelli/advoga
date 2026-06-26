# EP-0 — Foundation: Infraestrutura e Schema

> **Épico:** 0 · **Título:** Foundation — Infraestrutura, Schema e Dados Base
> **Fase AIOX:** FASE 0 (pré-drops)
> **Status:** Draft
> **Agentes responsáveis:** Morgan (@pm) · Aria (@architect) · Dara (@data-engineer)
> **PRD Trace:** PRD.md §12 (stack), §9 (modelo de dados), D-01..D-07

---

## Objetivo

Scaffoldar o projeto, confirmar a arquitetura dos 4 ambientes, fechar o schema do banco, aplicar as migrations e RLS no Supabase da Kamile — tudo antes de qualquer feature de Drop 1. Sem esta fundação, nenhuma story de EP-1 pode ser implementada.

---

## Escopo

### Inclui
- Scaffold Next.js + TypeScript + Tailwind + Supabase client no `apps/_active/advoga/`
- Arquitetura formal dos 4 ambientes (Teste, Estudo, Consulta, Verificação) documentada
- Schema completo do Supabase (DDL): `materias`, `subtemas`, `micro_topicos`, `dimensoes`, `dimensao_valores`, `exames`, `questoes`, `questao_tags`, `sessoes`, `respostas`, `diagnostico`, `plano_diario`
- Políticas RLS single-user (user_id = Kamile)
- `.env.example` com variáveis necessárias (sem valores reais)
- Seed de materias + pesos de incidência (dados §6 do PRD)
- Deploy mínimo no Vercel (CI/CD pipeline)
- Documentação: coding standards + source tree + tech stack (arquivos `docs/framework/`)

### Não inclui
- Feature alguma de UI (fica em EP-1+)
- Pipeline de ingestão de PDFs (EP-1, story 1.1)
- Motor de Descoberta de Variáveis (EP-2)
- Motor de Validade Legal completo (EP-3)

---

## Acceptance Criteria (Alto Nível)

- [ ] AC-0.1: Repositório scaffoldado com Next.js + TypeScript + Tailwind; roda localmente (`npm run dev`) sem erros.
- [ ] AC-0.2: Documentação de arquitetura (4 ambientes + fluxo de dados) aprovada por Aria.
- [ ] AC-0.3: Schema aplicado no Supabase da Kamile via migrations versionadas (`supabase/migrations/`). Nenhum schema hardcoded.
- [ ] AC-0.4: RLS configurado: toda query retorna apenas dados do `user_id` da Kamile. Testado com query direta no Supabase SQL editor.
- [ ] AC-0.5: Seed inicial: 20 matérias com `grupo` (A/B/C) e `questoes_por_prova` corretos conforme PRD §5.
- [ ] AC-0.6: `.env.example` documentado com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Nunca commitar `.env`.
- [ ] AC-0.7: Deploy Vercel funcional: branch `main` deploya automaticamente.
- [ ] AC-0.8: `docs/framework/tech-stack.md`, `docs/framework/coding-standards.md`, `docs/framework/source-tree.md` escritos (necessários para @dev carregar contexto).

---

## Dependências

- Nenhuma dependência de épico anterior.
- **Bloqueia:** EP-1, EP-2, EP-3 (todos dependem do schema).
- **Input necessário (externo):** `PROJECT_REF` + keys do Supabase da Kamile (fornecido pelo owner antes do kickoff da Fase 1).

---

## Definição de Pronto

- Schema no Supabase da Kamile: migrations aplicadas, RLS ativo, seed de matérias inserido.
- Projeto buildável e deployável no Vercel.
- Arquitetura documentada e revisada.
- Nenhuma chave real commitada ao git.
- @architect aprovou a arquitetura dos 4 ambientes.
- @data-engineer aprovou o DDL e as políticas RLS.

---

## CHANGELOG

| Data | Evento |
|---|---|
| 2026-06-21 | EP-0 criado por Morgan (@pm) — fundação para o build Advoga. |
