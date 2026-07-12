-- Barraca Easy - Fase 1 SaaS (issue #28)
-- Modelo de dados multi-tenant + Row-Level Security por tenant.
--
-- Tabelas: tenants, membros, produtos, pedidos, pedido_itens, fechamentos.
-- Toda tabela de dados carrega tenant_id e e isolada por RLS.
-- Idempotente onde possivel (IF NOT EXISTS / CREATE OR REPLACE).

-- =====================================================================
-- 1. Tabelas
-- =====================================================================

create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  slug       text unique,
  created_at timestamptz not null default now()
);

-- Vinculo entre usuario do Supabase Auth (auth.users) e um tenant, com papel.
create table if not exists public.membros (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  papel      text not null check (papel in ('dono','operador')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists membros_user_idx on public.membros(user_id);
create index if not exists membros_tenant_idx on public.membros(tenant_id);

create table if not exists public.produtos (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  nome       text not null,
  categoria  text,
  preco      numeric(10,2) not null default 0,
  emoji      text,
  descricao  text,
  oculto     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists produtos_tenant_idx on public.produtos(tenant_id);

create table if not exists public.pedidos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  senha           text not null,
  forma_pagamento text not null,
  total           numeric(10,2) not null default 0,
  status          text not null default 'aguardando'
                    check (status in ('aguardando','chamado','entregue','cancelado')),
  created_at      timestamptz not null default now(),
  paid_at         timestamptz,
  called_at       timestamptz,
  delivered_at    timestamptz,
  cancelled_at    timestamptz
);
create index if not exists pedidos_tenant_idx on public.pedidos(tenant_id);
create index if not exists pedidos_tenant_status_idx on public.pedidos(tenant_id, status);

-- Regra de negocio (#5): senha nao pode repetir no MESMO DIA dentro do tenant,
-- exceto quando o pedido anterior esta cancelado. Dia calculado no fuso local
-- (America/Sao_Paulo) para bater com a operacao da barraca.
create unique index if not exists pedidos_senha_dia_unica
  on public.pedidos (
    tenant_id,
    senha,
    ((created_at at time zone 'America/Sao_Paulo')::date)
  )
  where status <> 'cancelado';

-- Itens do pedido. Guardam snapshot (nome/categoria/preco) do momento da venda,
-- para o relatorio nao depender do produto continuar existindo/inalterado.
create table if not exists public.pedido_itens (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  pedido_id   uuid not null references public.pedidos(id) on delete cascade,
  produto_id  uuid references public.produtos(id) on delete set null,
  nome        text not null,
  categoria   text,
  preco_unit  numeric(10,2) not null default 0,
  quantidade  integer not null default 1 check (quantidade > 0)
);
create index if not exists pedido_itens_pedido_idx on public.pedido_itens(pedido_id);
create index if not exists pedido_itens_tenant_idx on public.pedido_itens(tenant_id);

-- Fechamento de caixa: snapshot completo dos pedidos do periodo + resumo
-- pre-calculado (mesmo desenho do closingsService atual, agora por tenant).
create table if not exists public.fechamentos (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  closed_at    timestamptz not null default now(),
  period_start timestamptz,
  snapshot     jsonb not null default '[]'::jsonb,
  summary      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists fechamentos_tenant_idx on public.fechamentos(tenant_id);

-- =====================================================================
-- 2. Helpers de autorizacao (SECURITY DEFINER evita recursao de RLS em membros)
-- =====================================================================

create or replace function public.is_tenant_member(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membros m
    where m.tenant_id = t and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_owner(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membros m
    where m.tenant_id = t and m.user_id = auth.uid() and m.papel = 'dono'
  );
$$;

-- =====================================================================
-- 3. RLS
-- =====================================================================

alter table public.tenants      enable row level security;
alter table public.membros      enable row level security;
alter table public.produtos     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.fechamentos  enable row level security;

-- tenants: membro le/edita o proprio tenant; qualquer autenticado pode criar
-- (o onboarding do #30 cria tenant + membro dono, idealmente via RPC atomica).
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select using (public.is_tenant_member(id));

drop policy if exists tenants_insert on public.tenants;
create policy tenants_insert on public.tenants
  for insert with check (auth.uid() is not null);

drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update using (public.is_tenant_owner(id)) with check (public.is_tenant_owner(id));

drop policy if exists tenants_delete on public.tenants;
create policy tenants_delete on public.tenants
  for delete using (public.is_tenant_owner(id));

-- membros: membro ve os colegas do tenant; apenas o dono gerencia membros.
-- Excecao de bootstrap: o usuario pode inserir o PROPRIO vinculo (necessario
-- para o onboarding ligar o dono ao tenant recem-criado).
drop policy if exists membros_select on public.membros;
create policy membros_select on public.membros
  for select using (public.is_tenant_member(tenant_id));

drop policy if exists membros_insert on public.membros;
create policy membros_insert on public.membros
  for insert with check (
    public.is_tenant_owner(tenant_id) or user_id = auth.uid()
  );

drop policy if exists membros_update on public.membros;
create policy membros_update on public.membros
  for update using (public.is_tenant_owner(tenant_id))
  with check (public.is_tenant_owner(tenant_id));

drop policy if exists membros_delete on public.membros;
create policy membros_delete on public.membros
  for delete using (public.is_tenant_owner(tenant_id));

-- Tabelas de dados operacionais: acesso total apenas para membros do tenant.
drop policy if exists produtos_all on public.produtos;
create policy produtos_all on public.produtos
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists pedidos_all on public.pedidos;
create policy pedidos_all on public.pedidos
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists pedido_itens_all on public.pedido_itens;
create policy pedido_itens_all on public.pedido_itens
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists fechamentos_all on public.fechamentos;
create policy fechamentos_all on public.fechamentos
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- =====================================================================
-- 4. Grants (RLS continua sendo o portao; grants liberam o acesso base)
-- =====================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.tenants, public.membros, public.produtos,
  public.pedidos, public.pedido_itens, public.fechamentos
  to authenticated;
