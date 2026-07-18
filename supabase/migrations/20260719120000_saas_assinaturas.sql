-- Barraca Easy - SaaS minimo viavel (issue #89, epic #26)
--
-- Camada de ASSINATURA sobre o multi-tenant que ja existe (#28). Nao recomeca
-- nada: tenants, membros, RLS por tenant e as RPCs de pedido continuam como
-- estao. Aqui entra so o que faltava para vender o app:
--
--   1. o cliente (barraca) tem plano, status e prazo de teste;
--   2. o status manda no acesso — e manda NO BANCO, nao na tela;
--   3. existe historico de cobranca com baixa manual (Pix recebido por fora).
--
-- Custo fixo zero: tudo isso e tabela no mesmo projeto Supabase free tier.
-- Gateway (Asaas/Mercado Pago) NAO entra agora; fica o gancho
-- `cobrancas.referencia_externa` para plugar depois sem migrar dado.
--
-- Idempotente (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).

-- =====================================================================
-- 1. Assinatura no tenant
-- =====================================================================
--
-- A coluna entra SEM default primeiro, para separar quem ja existia de quem
-- vai nascer: barraca que ja usava o app vira 'ativa' (ninguem acorda
-- bloqueado por causa de deploy), e so depois o default 'teste' passa a valer
-- para os cadastros novos.

alter table public.tenants add column if not exists plano             text;
alter table public.tenants add column if not exists status_assinatura text;
alter table public.tenants add column if not exists teste_expira_em   date;
alter table public.tenants add column if not exists valor_mensal      numeric(10,2);
alter table public.tenants add column if not exists observacao_admin  text;
alter table public.tenants add column if not exists assinatura_em     timestamptz;

update public.tenants
   set plano             = coalesce(plano, 'gratis'),
       status_assinatura = coalesce(status_assinatura, 'ativa'),
       valor_mensal      = coalesce(valor_mensal, 0)
 where plano is null or status_assinatura is null or valor_mensal is null;

alter table public.tenants alter column plano             set default 'gratis';
alter table public.tenants alter column status_assinatura set default 'teste';
alter table public.tenants alter column valor_mensal      set default 0;
alter table public.tenants alter column teste_expira_em   set default (current_date + 30);

alter table public.tenants alter column plano             set not null;
alter table public.tenants alter column status_assinatura set not null;
alter table public.tenants alter column valor_mensal      set not null;

do $$
begin
  alter table public.tenants add constraint tenants_status_assinatura_chk
    check (status_assinatura in ('teste','ativa','suspensa','cancelada'));
exception when duplicate_object then null;
end $$;

create index if not exists tenants_status_idx on public.tenants(status_assinatura);

-- =====================================================================
-- 2. Admin da plataforma (o Felipe)
-- =====================================================================
--
-- Tabela em vez de e-mail chumbado no codigo: da para adicionar/remover sem
-- deploy, e o front nao precisa saber quem e admin — quem decide e o banco.

create table if not exists public.plataforma_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  created_at timestamptz not null default now()
);

create or replace function public.is_plataforma_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plataforma_admins a where a.user_id = auth.uid()
  );
$$;

-- =====================================================================
-- 3. Cobrancas (Pix manual)
-- =====================================================================
--
-- `competencia` e sempre o dia 1 do mes cobrado — assim "a mensalidade de
-- julho" tem identidade e nao vira cobranca duplicada por descuido.
-- `metodo` nasce 'pix_manual'; `referencia_externa` fica vazio hoje e guarda
-- o id da cobranca no gateway quando/se ele entrar.

create table if not exists public.cobrancas (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  competencia        date not null,
  valor              numeric(10,2) not null default 0,
  vencimento         date,
  status             text not null default 'aberta'
                       check (status in ('aberta','paga','cancelada')),
  metodo             text not null default 'pix_manual',
  referencia_externa text,
  pago_em            timestamptz,
  observacao         text,
  criada_por         uuid references auth.users(id),
  baixada_por        uuid references auth.users(id),
  created_at         timestamptz not null default now()
);

create index if not exists cobrancas_tenant_idx on public.cobrancas(tenant_id, competencia desc);

-- Uma cobranca viva por mes e por barraca. Cancelada nao conta: permite
-- refazer uma cobranca lancada errada sem apagar historico.
create unique index if not exists cobrancas_competencia_unica
  on public.cobrancas(tenant_id, competencia)
  where status <> 'cancelada';

-- =====================================================================
-- 4. Portao de acesso: o que e uma barraca "ativa"
-- =====================================================================
--
-- Regra unica, usada pela RLS e pelas RPCs. Teste vale ate a data marcada;
-- passou disso, e como suspensa. Suspensa e cancelada nao escrevem nada.

create or replace function public.tenant_ativo(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenants x
    where x.id = t
      and (
        x.status_assinatura = 'ativa'
        or (x.status_assinatura = 'teste'
            and coalesce(x.teste_expira_em, current_date) >= current_date)
      )
  );
$$;

-- Membro E com assinatura em dia: e isso que libera escrita.
create or replace function public.pode_operar(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_tenant_member(t) and public.tenant_ativo(t);
$$;

-- =====================================================================
-- 5. RLS: suspensa LE, mas nao ESCREVE
-- =====================================================================
--
-- A separacao importa. Bloquear leitura junto seria punir o cliente errado:
-- o dono que atrasou o Pix precisa continuar vendo o fechamento do mes
-- passado e o historico da cobranca para poder pagar. O que ele nao pode e
-- seguir operando de graca. Entao: SELECT continua por membro; INSERT,
-- UPDATE e DELETE passam a exigir assinatura em dia.

-- produtos
drop policy if exists produtos_all    on public.produtos;
drop policy if exists produtos_select on public.produtos;
drop policy if exists produtos_write  on public.produtos;
create policy produtos_select on public.produtos
  for select using (public.is_tenant_member(tenant_id));
create policy produtos_insert on public.produtos
  for insert with check (public.pode_operar(tenant_id));
create policy produtos_update on public.produtos
  for update using (public.pode_operar(tenant_id))
  with check (public.pode_operar(tenant_id));
create policy produtos_delete on public.produtos
  for delete using (public.pode_operar(tenant_id));

-- pedidos
drop policy if exists pedidos_all    on public.pedidos;
drop policy if exists pedidos_select on public.pedidos;
create policy pedidos_select on public.pedidos
  for select using (public.is_tenant_member(tenant_id));
create policy pedidos_insert on public.pedidos
  for insert with check (public.pode_operar(tenant_id));
create policy pedidos_update on public.pedidos
  for update using (public.pode_operar(tenant_id))
  with check (public.pode_operar(tenant_id));
create policy pedidos_delete on public.pedidos
  for delete using (public.pode_operar(tenant_id));

-- pedido_itens
drop policy if exists pedido_itens_all    on public.pedido_itens;
drop policy if exists pedido_itens_select on public.pedido_itens;
create policy pedido_itens_select on public.pedido_itens
  for select using (public.is_tenant_member(tenant_id));
create policy pedido_itens_insert on public.pedido_itens
  for insert with check (public.pode_operar(tenant_id));
create policy pedido_itens_update on public.pedido_itens
  for update using (public.pode_operar(tenant_id))
  with check (public.pode_operar(tenant_id));
create policy pedido_itens_delete on public.pedido_itens
  for delete using (public.pode_operar(tenant_id));

-- fechamentos
drop policy if exists fechamentos_all    on public.fechamentos;
drop policy if exists fechamentos_select on public.fechamentos;
create policy fechamentos_select on public.fechamentos
  for select using (public.is_tenant_member(tenant_id));
create policy fechamentos_insert on public.fechamentos
  for insert with check (public.pode_operar(tenant_id));
create policy fechamentos_update on public.fechamentos
  for update using (public.pode_operar(tenant_id))
  with check (public.pode_operar(tenant_id));
create policy fechamentos_delete on public.fechamentos
  for delete using (public.pode_operar(tenant_id));

-- tenants: o admin enxerga todas as barracas.
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select using (public.is_tenant_member(id) or public.is_plataforma_admin());

-- BURACO QUE PRECISA FECHAR: `tenants_update` deixa o DONO editar o proprio
-- tenant (renomear a barraca). Sem limite de coluna, o dono se colocaria em
-- 'ativa' sozinho com uma chamada de API e a assinatura viraria enfeite.
-- RLS nao filtra coluna; GRANT filtra. Entao o UPDATE do usuario comum fica
-- restrito a nome/slug. As colunas de cobranca so mudam pelas RPCs de admin
-- (SECURITY DEFINER), que checam is_plataforma_admin().
revoke update on public.tenants from authenticated;
grant  update (nome, slug) on public.tenants to authenticated;

-- cobrancas: o dono ve as proprias (para saber o que deve); o admin faz tudo.
alter table public.cobrancas        enable row level security;
alter table public.plataforma_admins enable row level security;

drop policy if exists cobrancas_select on public.cobrancas;
create policy cobrancas_select on public.cobrancas
  for select using (
    public.is_tenant_owner(tenant_id) or public.is_plataforma_admin()
  );

-- Escrita de cobranca NAO tem policy de propósito: ninguem escreve direto na
-- tabela, nem o admin. Toda mudanca passa pelas RPCs abaixo, que registram
-- quem fez e mantem status do cliente e cobranca coerentes entre si.

drop policy if exists plataforma_admins_select on public.plataforma_admins;
create policy plataforma_admins_select on public.plataforma_admins
  for select using (user_id = auth.uid() or public.is_plataforma_admin());

grant select on public.cobrancas to authenticated;
grant select on public.plataforma_admins to authenticated;

-- =====================================================================
-- 6. create_order tambem respeita a assinatura
-- =====================================================================
--
-- A RPC e SECURITY DEFINER, entao ela PASSA POR CIMA da RLS de pedidos. Se a
-- checagem nao subir para `pode_operar` aqui tambem, a barraca suspensa
-- continua vendendo pela porta dos fundos — que e justamente o caminho que o
-- app usa. Uma linha, mas e a linha que faz o bloqueio existir de verdade.

create or replace function public.create_order(
  p_tenant_id       uuid,
  p_senha           text,
  p_forma_pagamento text,
  p_total           numeric,
  p_itens           jsonb
)
returns public.pedidos
language plpgsql
security definer
set search_path = public
as $FUNC$
declare
  v_pedido public.pedidos;
  v_now    timestamptz := now();
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  if not public.tenant_ativo(p_tenant_id) then
    raise exception 'Assinatura inativa. Regularize para voltar a lancar pedidos.'
      using errcode = '42501';
  end if;

  insert into public.pedidos
    (tenant_id, senha, forma_pagamento, total, status, created_at, paid_at)
  values
    (p_tenant_id, p_senha, p_forma_pagamento, coalesce(p_total, 0),
     'aguardando', v_now, v_now)
  returning * into v_pedido;

  insert into public.pedido_itens
    (tenant_id, pedido_id, produto_id, nome, categoria, preco_unit, quantidade)
  select
    p_tenant_id,
    v_pedido.id,
    nullif(it->>'produto_id', '')::uuid,
    it->>'nome',
    it->>'categoria',
    coalesce((it->>'preco_unit')::numeric, 0),
    coalesce((it->>'quantidade')::int, 1)
  from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) as it;

  return v_pedido;
exception
  when unique_violation then
    raise exception 'A senha % ja foi usada hoje.', p_senha using errcode = '23505';
end;
$FUNC$;

-- =====================================================================
-- 7. O que a propria barraca ve da sua assinatura
-- =====================================================================

create or replace function public.minha_assinatura(p_tenant_id uuid)
returns table (
  tenant_id         uuid,
  nome              text,
  plano             text,
  status_assinatura text,
  teste_expira_em   date,
  valor_mensal      numeric,
  ativo             boolean,
  dias_restantes    integer,
  cobrancas_abertas integer,
  proximo_vencimento date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.nome,
    t.plano,
    t.status_assinatura,
    t.teste_expira_em,
    t.valor_mensal,
    public.tenant_ativo(t.id),
    case when t.status_assinatura = 'teste' and t.teste_expira_em is not null
         then (t.teste_expira_em - current_date)::int end,
    (select count(*)::int from public.cobrancas c
      where c.tenant_id = t.id and c.status = 'aberta'),
    (select min(c.vencimento) from public.cobrancas c
      where c.tenant_id = t.id and c.status = 'aberta')
  from public.tenants t
  where t.id = p_tenant_id
    and public.is_tenant_member(t.id);
$$;

-- =====================================================================
-- 8. RPCs de administracao (so o admin da plataforma)
-- =====================================================================

create or replace function public.admin_listar_barracas()
returns table (
  id                 uuid,
  nome               text,
  plano              text,
  status_assinatura  text,
  teste_expira_em    date,
  valor_mensal       numeric,
  ativo              boolean,
  observacao_admin   text,
  criada_em          timestamptz,
  membros            integer,
  pedidos_total      integer,
  ultimo_pedido      timestamptz,
  cobrancas_abertas  integer,
  valor_em_aberto    numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;

  return query
  select
    t.id, t.nome, t.plano, t.status_assinatura, t.teste_expira_em,
    t.valor_mensal, public.tenant_ativo(t.id), t.observacao_admin, t.created_at,
    (select count(*)::int from public.membros m where m.tenant_id = t.id),
    (select count(*)::int from public.pedidos p
      where p.tenant_id = t.id and p.status <> 'cancelado'),
    (select max(p.created_at) from public.pedidos p where p.tenant_id = t.id),
    (select count(*)::int from public.cobrancas c
      where c.tenant_id = t.id and c.status = 'aberta'),
    (select coalesce(sum(c.valor), 0) from public.cobrancas c
      where c.tenant_id = t.id and c.status = 'aberta')
  from public.tenants t
  order by t.created_at desc;
end;
$$;

create or replace function public.admin_definir_status(
  p_tenant_id       uuid,
  p_status          text,
  p_plano           text default null,
  p_valor_mensal    numeric default null,
  p_teste_expira_em date default null,
  p_observacao      text default null
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.tenants;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;
  if p_status not in ('teste','ativa','suspensa','cancelada') then
    raise exception 'Status invalido: %', p_status;
  end if;

  update public.tenants
     set status_assinatura = p_status,
         plano             = coalesce(p_plano, plano),
         valor_mensal      = coalesce(p_valor_mensal, valor_mensal),
         teste_expira_em   = case when p_status = 'teste'
                                  then coalesce(p_teste_expira_em, teste_expira_em)
                                  else teste_expira_em end,
         observacao_admin  = coalesce(p_observacao, observacao_admin),
         assinatura_em     = case when p_status = 'ativa' and status_assinatura <> 'ativa'
                                  then now() else assinatura_em end
   where id = p_tenant_id
   returning * into v;

  if v.id is null then
    raise exception 'Barraca nao encontrada.';
  end if;
  return v;
end;
$$;

create or replace function public.admin_listar_cobrancas(p_tenant_id uuid default null)
returns setof public.cobrancas
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;
  return query
    select * from public.cobrancas c
     where p_tenant_id is null or c.tenant_id = p_tenant_id
     order by c.competencia desc, c.created_at desc;
end;
$$;

-- Gera a cobranca do mes. `competencia` e normalizada para o dia 1, entao
-- mandar 15/07 ou 01/07 da na mesma cobranca — nao tem como duplicar julho.
create or replace function public.admin_gerar_cobranca(
  p_tenant_id   uuid,
  p_competencia date default null,
  p_valor       numeric default null,
  p_vencimento  date default null,
  p_observacao  text default null
)
returns public.cobrancas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comp  date;
  v_valor numeric;
  v       public.cobrancas;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;

  v_comp  := date_trunc('month', coalesce(p_competencia, current_date))::date;
  v_valor := coalesce(p_valor, (select valor_mensal from public.tenants where id = p_tenant_id));

  if v_valor is null then
    raise exception 'Barraca nao encontrada.';
  end if;

  insert into public.cobrancas
    (tenant_id, competencia, valor, vencimento, status, metodo, observacao, criada_por)
  values
    (p_tenant_id, v_comp, v_valor,
     coalesce(p_vencimento, v_comp + 9), 'aberta', 'pix_manual',
     p_observacao, auth.uid())
  returning * into v;

  return v;
exception
  when unique_violation then
    raise exception 'Ja existe cobranca de % para esta barraca.',
      to_char(v_comp, 'MM/YYYY');
end;
$$;

-- Baixa manual: o Pix caiu na conta do Felipe, ele confirma aqui.
-- A reativacao anda junto de proposito: separar "dar baixa" de "liberar o
-- acesso" seria criar o bug classico de cliente que pagou e continua travado
-- porque alguem esqueceu do segundo clique.
create or replace function public.admin_baixar_cobranca(
  p_cobranca_id uuid,
  p_pago_em     timestamptz default null,
  p_observacao  text default null
)
returns public.cobrancas
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.cobrancas;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;

  update public.cobrancas
     set status      = 'paga',
         pago_em     = coalesce(p_pago_em, now()),
         observacao  = coalesce(p_observacao, observacao),
         baixada_por = auth.uid()
   where id = p_cobranca_id and status <> 'cancelada'
   returning * into v;

  if v.id is null then
    raise exception 'Cobranca nao encontrada ou cancelada.';
  end if;

  -- Pagou e nao ficou nada em aberto: volta a operar.
  if not exists (
    select 1 from public.cobrancas c
     where c.tenant_id = v.tenant_id and c.status = 'aberta'
  ) then
    update public.tenants
       set status_assinatura = 'ativa',
           assinatura_em     = coalesce(assinatura_em, now())
     where id = v.tenant_id
       and status_assinatura in ('teste','suspensa');
  end if;

  return v;
end;
$$;

create or replace function public.admin_cancelar_cobranca(
  p_cobranca_id uuid,
  p_motivo      text default null
)
returns public.cobrancas
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.cobrancas;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;

  update public.cobrancas
     set status = 'cancelada', observacao = coalesce(p_motivo, observacao)
   where id = p_cobranca_id
   returning * into v;

  if v.id is null then
    raise exception 'Cobranca nao encontrada.';
  end if;
  return v;
end;
$$;

-- =====================================================================
-- 9. Grants das RPCs (RLS/checagem interna continua sendo o portao)
-- =====================================================================
revoke all on function public.admin_listar_barracas()                              from public, anon;
revoke all on function public.admin_definir_status(uuid, text, text, numeric, date, text) from public, anon;
revoke all on function public.admin_listar_cobrancas(uuid)                         from public, anon;
revoke all on function public.admin_gerar_cobranca(uuid, date, numeric, date, text) from public, anon;
revoke all on function public.admin_baixar_cobranca(uuid, timestamptz, text)       from public, anon;
revoke all on function public.admin_cancelar_cobranca(uuid, text)                  from public, anon;
revoke all on function public.minha_assinatura(uuid)                               from public, anon;

grant execute on function public.admin_listar_barracas()                              to authenticated;
grant execute on function public.admin_definir_status(uuid, text, text, numeric, date, text) to authenticated;
grant execute on function public.admin_listar_cobrancas(uuid)                         to authenticated;
grant execute on function public.admin_gerar_cobranca(uuid, date, numeric, date, text) to authenticated;
grant execute on function public.admin_baixar_cobranca(uuid, timestamptz, text)       to authenticated;
grant execute on function public.admin_cancelar_cobranca(uuid, text)                  to authenticated;
grant execute on function public.minha_assinatura(uuid)                               to authenticated;
grant execute on function public.tenant_ativo(uuid)                                   to authenticated;
grant execute on function public.pode_operar(uuid)                                    to authenticated;
grant execute on function public.is_plataforma_admin()                                to authenticated;
