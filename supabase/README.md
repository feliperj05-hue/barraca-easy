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

## Autenticacao e papeis (#29)

Login e-mail/senha via Supabase Auth. Papeis `dono` / `operador` vem da tabela
`membros`. RPCs adicionadas em `migrations/20260712130000_auth_member_rpcs.sql`:

- `add_member(p_tenant_id, p_email, p_papel)` — dono vincula um usuario JA
  EXISTENTE (por e-mail) ao seu tenant.
- `list_tenant_members(p_tenant_id)` — lista membros do tenant com e-mail.

Aplicar a migration do mesmo jeito da #28 (SQL Editor, script idempotente).

## Onboarding — criar barraca (#30)

Criar a barraca gera o **tenant** e o vinculo do **dono** numa unica transacao
coerente. RPC adicionada em `migrations/20260712140000_onboarding_tenant_rpc.sql`:

- `create_tenant_with_owner(p_nome)` — o usuario logado cria a barraca e ja fica
  vinculado como `dono`. Roda numa unica funcao (SECURITY DEFINER) => uma unica
  transacao: se qualquer passo falhar, nada e persistido (sem tenant orfao). O
  vinculo do dono usa sempre `auth.uid()` no servidor. Guarda contra 2o tenant
  para o mesmo usuario (Fase 1 assume 1 tenant por usuario).

Substitui os dois inserts client-side (`tenants` + `membros`) que o onboarding
minimo da #29 usava. Aplicar do mesmo jeito (SQL Editor, script idempotente).

### O que conferir no painel do Supabase
- **Authentication > Providers > Email**: habilitado.
- **Confirm email**: LIGADO (decisao do produto). Consequencia: todo usuario novo
  precisa confirmar o e-mail antes do primeiro login. O operador se cadastra,
  confirma o e-mail, e so entao o dono consegue vincula-lo por `add_member`.
- **Authentication > URL Configuration**: Site URL =
  `https://feliperj05-hue.github.io/barraca-easy/` e a mesma URL em Redirect URLs.
- **Signups**: habilitados (para auto-cadastro do operador).

### Teste de isolamento de RLS
`tests/rls_isolation.mjs` valida, com tokens de usuarios reais, que um tenant
nao le nem escreve dados de outro (e a regra de senha unica por dia).

Como Confirm email esta ligado, o script precisa de **2 usuarios ja
confirmados**. Crie-os em Authentication > Users (ou cadastre + confirme), e
rode:

```bash
RLS_USER_A_EMAIL=a@exemplo.com RLS_USER_A_PASSWORD=... \
RLS_USER_B_EMAIL=b@exemplo.com RLS_USER_B_PASSWORD=... \
node supabase/tests/rls_isolation.mjs
```

URL/key sao lidas de `.env.local`. Saida esperada: todos os checks em PASS.
