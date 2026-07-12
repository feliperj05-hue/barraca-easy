# Supabase — Barraca Easy (Fase 1 SaaS)

Backend confirmado: **Supabase** (Postgres + Auth). Multi-tenant via `tenant_id`
em todas as tabelas + **Row-Level Security** (cada barraca so enxerga os
proprios dados). Ver epic #26 e issue #28.

## Migrations

`migrations/` guarda o schema versionado em SQL puro. Nomeacao no padrao do
Supabase CLI: `<timestamp>_<nome>.sql`.

- `20260712120000_init_multitenant.sql` — schema inicial (#28): tabelas
  `tenants`, `membros`, `produtos`, `pedidos`, `pedido_itens`, `fechamentos`,
  helpers `is_tenant_member` / `is_tenant_owner` (SECURITY DEFINER) e policies
  de RLS por tenant.

## Como aplicar (o dono do projeto Supabase)

O agente **nao** aplica DDL no banco (so tem a publishable key, que nao faz DDL;
a `service_role` nunca vai ao repo/ambiente do agente). A aplicacao e manual:

### Opcao A — SQL Editor (recomendada, sem instalar nada)
1. Painel do Supabase > **SQL Editor** > New query.
2. Cole todo o conteudo de `migrations/20260712120000_init_multitenant.sql`.
3. **Run**. O script e idempotente (`if not exists` / `create or replace`),
   entao pode rodar novamente sem quebrar.

### Opcao B — Supabase CLI (se preferir versionar via CLI)
```bash
supabase link --project-ref <ref>
supabase db push
```

## Como validar o isolamento (RLS)

Depois de aplicar, com dois usuarios em tenants diferentes:
- Usuario A **nao** deve ler nem escrever linhas com `tenant_id` do tenant B.
- `select` sem sessao (anon) retorna vazio (RLS bloqueia).

Um roteiro de teste E2E de RLS entra junto com a autenticacao (#29), quando
houver usuarios reais para assumir sessao.
