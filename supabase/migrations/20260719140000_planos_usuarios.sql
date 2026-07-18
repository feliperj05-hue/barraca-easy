-- Barraca Easy - Planos por numero de usuarios (issue #94, epic #26)
--
-- Fecha o modelo comercial: cada barraca assina um plano, o plano diz quantas
-- pessoas podem operar, e esse limite vale NO BANCO. Mesma postura do #89 —
-- limite que so existe na tela nao e limite, e pedido de favor.
--
-- MODO 100% AUTONOMO: **a feature nao existe.** O Plano 4 carrega apenas a
-- flag `permite_modo_autonomo` como gancho comercial, para o dia em que ela
-- for construida. Nenhum texto voltado ao cliente promete essa funcao, e nada
-- neste arquivo a implementa.
--
-- Idempotente.

-- =====================================================================
-- 1. Catalogo de planos
-- =====================================================================
--
-- Tabela em vez de constante no codigo: preco muda, e mudar preco nao pode
-- exigir publicar versao nova do app. O nome comercial e literalmente
-- "Plano 1..4" porque foi o que o Felipe definiu — nao invento nome de
-- marca.

create table if not exists public.planos (
  codigo                text primary key,
  nome                  text not null,
  descricao             text,
  -- null = sem limite. Serve ao plano legado dos tenants que ja existiam.
  max_usuarios          integer,
  valor_mensal          numeric(10,2) not null default 0,
  -- Cobrada UMA VEZ na contratacao, separada da mensalidade.
  taxa_implantacao      numeric(10,2) not null default 0,
  -- Gancho comercial. NAO destrava nada hoje: a feature nao existe.
  permite_modo_autonomo boolean not null default false,
  -- Plano legado continua valendo para quem ja esta nele, mas nao aparece
  -- como opcao de contratacao nova.
  contratavel           boolean not null default true,
  ordem                 integer not null default 0
);

alter table public.planos enable row level security;

-- Catalogo e publico para quem esta logado: o dono precisa ver o que existe.
drop policy if exists planos_select on public.planos;
create policy planos_select on public.planos
  for select using (auth.uid() is not null);

-- Escrita so por RPC de admin (nenhuma policy de insert/update de proposito).
grant select on public.planos to authenticated;

-- Seed idempotente: reaplica preco sem duplicar linha.
insert into public.planos
  (codigo, nome, descricao, max_usuarios, valor_mensal, taxa_implantacao,
   permite_modo_autonomo, contratavel, ordem)
values
  ('plano_1', 'Plano 1', '1 usuário (caixa)',              1,  27.90,   0, false, true, 1),
  ('plano_2', 'Plano 2', '2 usuários (caixa + 1 operador)', 2,  35.00,   0, false, true, 2),
  ('plano_3', 'Plano 3', '5 usuários',                      5,  65.00,   0, false, true, 3),
  ('plano_4', 'Plano 4', '10 usuários',                    10, 150.00, 500, true,  true, 4),
  -- Plano legado: e onde os tenants criados antes desta migration estao.
  -- Sem limite e sem preco, para nenhuma barraca que ja rodava ser bloqueada
  -- ou cobrada por causa de um deploy. Nao aparece como opcao nova.
  ('gratis',  'Legado',  'Barraca anterior à tabela de preços', null, 0, 0, false, false, 99)
on conflict (codigo) do update set
  nome                  = excluded.nome,
  descricao             = excluded.descricao,
  max_usuarios          = excluded.max_usuarios,
  valor_mensal          = excluded.valor_mensal,
  taxa_implantacao      = excluded.taxa_implantacao,
  permite_modo_autonomo = excluded.permite_modo_autonomo,
  contratavel           = excluded.contratavel,
  ordem                 = excluded.ordem;

-- Liga tenants ao catalogo. Quem estiver com um plano fora da tabela cai no
-- legado antes da FK entrar, senao a constraint falharia.
update public.tenants
   set plano = 'gratis'
 where plano is null
    or plano not in (select codigo from public.planos);

do $$
begin
  alter table public.tenants
    add constraint tenants_plano_fk
    foreign key (plano) references public.planos(codigo);
exception when duplicate_object then null;
end $$;

-- =====================================================================
-- 2. Cobranca de implantacao x mensalidade
-- =====================================================================

alter table public.cobrancas add column if not exists tipo text;
update public.cobrancas set tipo = 'mensalidade' where tipo is null;
alter table public.cobrancas alter column tipo set default 'mensalidade';
alter table public.cobrancas alter column tipo set not null;

do $$
begin
  alter table public.cobrancas add constraint cobrancas_tipo_chk
    check (tipo in ('mensalidade','implantacao'));
exception when duplicate_object then null;
end $$;

-- O indice antigo travava UMA cobranca por mes por barraca, sem olhar o tipo.
-- Com a taxa de implantacao isso quebraria: ela cai no mesmo mes da primeira
-- mensalidade e uma bloquearia a outra. Trocado por dois indices com sentidos
-- diferentes:
drop index if exists public.cobrancas_competencia_unica;

--  a) mensalidade: uma por mes, por barraca.
create unique index if not exists cobrancas_mensalidade_unica
  on public.cobrancas(tenant_id, competencia)
  where tipo = 'mensalidade' and status <> 'cancelada';

--  b) implantacao: uma por barraca, PARA SEMPRE. E o banco garantindo o
--     "cobrada uma unica vez" — nao um cuidado do lado da tela.
create unique index if not exists cobrancas_implantacao_unica
  on public.cobrancas(tenant_id)
  where tipo = 'implantacao' and status <> 'cancelada';

-- =====================================================================
-- 3. Limite de usuarios (a regra que precisa valer de verdade)
-- =====================================================================

create or replace function public.limite_usuarios(t uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select p.max_usuarios
  from public.tenants x
  join public.planos p on p.codigo = x.plano
  where x.id = t;
$$;

create or replace function public.usuarios_no_tenant(t uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.membros m where m.tenant_id = t;
$$;

-- Cabe mais UM usuario novo nesta barraca?
--
-- `max_usuarios` nulo (plano legado) devolve true: barraca que ja rodava nao
-- pode ser travada por causa de um deploy.
create or replace function public.cabe_mais_um_usuario(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.usuarios_no_tenant(t) < public.limite_usuarios(t),
    true
  );
$$;

-- RLS de membros: alem de ser dono, precisa caber no plano.
--
-- O `or user_id = auth.uid()` do bootstrap continua — e como o dono se vincula
-- ao tenant recem-criado no onboarding. Nao ha furo: nesse instante a barraca
-- tem zero membros, entao cabe em qualquer plano, ate no de 1 usuario.
drop policy if exists membros_insert on public.membros;
create policy membros_insert on public.membros
  for insert with check (
    (public.is_tenant_owner(tenant_id) and public.cabe_mais_um_usuario(tenant_id))
    or user_id = auth.uid()
  );

-- add_member e SECURITY DEFINER, entao passa por cima da RLS acima — e e o
-- caminho que a tela de Membros usa. A checagem tem que existir aqui tambem,
-- senao o limite nao vale no unico lugar onde ele seria testado.
--
-- SUTILEZA QUE IMPORTA: esta funcao tambem serve para TROCAR O PAPEL de quem
-- ja e membro (o `on conflict do update`). Checar o limite sempre impediria o
-- dono de promover um operador com o plano cheio — que nao entra usuario
-- nenhum. Por isso o limite so e cobrado quando a pessoa e mesmo NOVA.
create or replace function public.add_member(
  p_tenant_id uuid,
  p_email     text,
  p_papel     text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_id      uuid;
  v_novo    boolean;
begin
  if not public.is_tenant_owner(p_tenant_id) then
    raise exception 'Apenas o dono pode adicionar membros.' using errcode = '42501';
  end if;

  if p_papel not in ('dono','operador') then
    raise exception 'Papel invalido: %', p_papel using errcode = '22023';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception
      'Nenhum usuario com o e-mail %. Peca para a pessoa criar a conta (e confirmar o e-mail) antes.',
      p_email using errcode = 'P0002';
  end if;

  v_novo := not exists (
    select 1 from public.membros m
    where m.tenant_id = p_tenant_id and m.user_id = v_user_id
  );

  if v_novo and not public.cabe_mais_um_usuario(p_tenant_id) then
    raise exception
      'O plano da barraca permite % usuário(s) e todos já estão em uso. Remova alguém ou mude de plano.',
      public.limite_usuarios(p_tenant_id) using errcode = '42501';
  end if;

  insert into public.membros (tenant_id, user_id, papel)
  values (p_tenant_id, v_user_id, p_papel)
  on conflict (tenant_id, user_id) do update set papel = excluded.papel
  returning id into v_id;

  return v_id;
end;
$$;

-- =====================================================================
-- 4. Contratacao de plano (admin)
-- =====================================================================
--
-- REBAIXAMENTO — decisao registrada:
--
-- Quando a barraca ja tem MAIS membros do que o plano novo comporta, a troca
-- **acontece assim mesmo** e **ninguem e removido**. O excedente continua
-- operando; o que trava e a entrada de gente nova, ate o numero voltar para
-- dentro do limite.
--
-- Por que nao as outras saidas:
-- - remover membro automaticamente derrubaria um operador no meio do
--   expediente, e no pior caso o proprio dono. Destrutivo e irreversivel.
-- - impedir a troca amarraria as maos do admin justamente quando ele mais
--   precisa dela (rebaixar quem esta devendo).
--
-- A RPC devolve o excedente para o painel avisar, em vez de agir sozinha.

create or replace function public.admin_contratar_plano(
  p_tenant_id      uuid,
  p_plano          text,
  p_gerar_setup    boolean default true,
  p_aplicar_preco  boolean default true
)
returns table (
  tenant_id       uuid,
  plano           text,
  valor_mensal    numeric,
  max_usuarios    integer,
  usuarios_atuais integer,
  excedente       integer,
  setup_gerado    boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano  public.planos;
  v_usados integer;
  v_setup  boolean := false;
  v_valor  numeric;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;

  select * into v_plano from public.planos where codigo = p_plano;
  if v_plano.codigo is null then
    raise exception 'Plano inexistente: %', p_plano;
  end if;

  update public.tenants
     set plano        = v_plano.codigo,
         valor_mensal = case when p_aplicar_preco
                             then v_plano.valor_mensal else valor_mensal end
   where id = p_tenant_id
   returning valor_mensal into v_valor;

  if v_valor is null then
    raise exception 'Barraca nao encontrada.';
  end if;

  -- Taxa de implantacao: uma vez na vida da barraca. O indice unico parcial
  -- e a garantia real; o `if not exists` so evita levantar excecao a toa.
  if p_gerar_setup and v_plano.taxa_implantacao > 0 then
    if not exists (
      select 1 from public.cobrancas c
       where c.tenant_id = p_tenant_id
         and c.tipo = 'implantacao'
         and c.status <> 'cancelada'
    ) then
      insert into public.cobrancas
        (tenant_id, competencia, valor, vencimento, status, tipo, metodo,
         observacao, criada_por)
      values
        (p_tenant_id, date_trunc('month', current_date)::date,
         v_plano.taxa_implantacao, current_date + 9, 'aberta', 'implantacao',
         'pix_manual', 'Taxa de implantação (cobrança única)', auth.uid());
      v_setup := true;
    end if;
  end if;

  v_usados := public.usuarios_no_tenant(p_tenant_id);

  return query select
    p_tenant_id,
    v_plano.codigo,
    v_valor,
    v_plano.max_usuarios,
    v_usados,
    greatest(v_usados - coalesce(v_plano.max_usuarios, v_usados), 0),
    v_setup;
end;
$$;

-- =====================================================================
-- 5. Gerar cobranca ganha tipo
-- =====================================================================

create or replace function public.admin_gerar_cobranca(
  p_tenant_id   uuid,
  p_competencia date default null,
  p_valor       numeric default null,
  p_vencimento  date default null,
  p_observacao  text default null,
  p_tipo        text default 'mensalidade'
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

  if p_tipo not in ('mensalidade','implantacao') then
    raise exception 'Tipo de cobranca invalido: %', p_tipo;
  end if;

  v_comp := date_trunc('month', coalesce(p_competencia, current_date))::date;

  if p_tipo = 'implantacao' then
    v_valor := coalesce(
      p_valor,
      (select pl.taxa_implantacao from public.tenants t
         join public.planos pl on pl.codigo = t.plano
        where t.id = p_tenant_id)
    );
  else
    v_valor := coalesce(
      p_valor,
      (select valor_mensal from public.tenants where id = p_tenant_id)
    );
  end if;

  if v_valor is null then
    raise exception 'Barraca nao encontrada.';
  end if;

  insert into public.cobrancas
    (tenant_id, competencia, valor, vencimento, status, tipo, metodo,
     observacao, criada_por)
  values
    (p_tenant_id, v_comp, v_valor, coalesce(p_vencimento, v_comp + 9),
     'aberta', p_tipo, 'pix_manual', p_observacao, auth.uid())
  returning * into v;

  return v;
exception
  when unique_violation then
    if p_tipo = 'implantacao' then
      raise exception 'Esta barraca já tem taxa de implantação lançada.';
    else
      raise exception 'Ja existe cobranca de % para esta barraca.',
        to_char(v_comp, 'MM/YYYY');
    end if;
end;
$$;

-- =====================================================================
-- 6. Leitura: plano e uso aparecem para quem precisa
-- =====================================================================

-- ATENCAO: as duas funcoes abaixo GANHARAM COLUNAS no retorno (plano_nome,
-- max_usuarios, usuarios_atuais). O Postgres recusa `create or replace` que
-- muda o tipo de retorno — o erro e "cannot change return type of existing
-- function". Por isso o drop explicito antes de recriar. O parser de sintaxe
-- nao pega isso; so a aplicacao real pegaria, e ai seria em cima da hora.
drop function if exists public.minha_assinatura(uuid);
drop function if exists public.admin_listar_barracas();

create or replace function public.minha_assinatura(p_tenant_id uuid)
returns table (
  tenant_id          uuid,
  nome               text,
  plano              text,
  plano_nome         text,
  plano_descricao    text,
  max_usuarios       integer,
  usuarios_atuais    integer,
  status_assinatura  text,
  teste_expira_em    date,
  valor_mensal       numeric,
  ativo              boolean,
  dias_restantes     integer,
  cobrancas_abertas  integer,
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
    p.nome,
    p.descricao,
    p.max_usuarios,
    public.usuarios_no_tenant(t.id),
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
  left join public.planos p on p.codigo = t.plano
  where t.id = p_tenant_id
    and public.is_tenant_member(t.id);
$$;

create or replace function public.admin_listar_barracas()
returns table (
  id                 uuid,
  nome               text,
  plano              text,
  plano_nome         text,
  max_usuarios       integer,
  usuarios_atuais    integer,
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
    t.id, t.nome, t.plano, pl.nome, pl.max_usuarios,
    public.usuarios_no_tenant(t.id),
    t.status_assinatura, t.teste_expira_em,
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
  left join public.planos pl on pl.codigo = t.plano
  order by t.created_at desc;
end;
$$;

-- =====================================================================
-- 7. Grants
-- =====================================================================
revoke all on function public.admin_contratar_plano(uuid, text, boolean, boolean) from public, anon;
revoke all on function public.admin_gerar_cobranca(uuid, date, numeric, date, text, text) from public, anon;
revoke all on function public.limite_usuarios(uuid)      from public, anon;
revoke all on function public.usuarios_no_tenant(uuid)   from public, anon;
revoke all on function public.cabe_mais_um_usuario(uuid) from public, anon;

grant execute on function public.admin_contratar_plano(uuid, text, boolean, boolean) to authenticated;
grant execute on function public.admin_gerar_cobranca(uuid, date, numeric, date, text, text) to authenticated;
grant execute on function public.limite_usuarios(uuid)      to authenticated;
grant execute on function public.usuarios_no_tenant(uuid)   to authenticated;
grant execute on function public.cabe_mais_um_usuario(uuid) to authenticated;

-- A assinatura antiga de admin_gerar_cobranca (5 args) fica orfa depois que o
-- client passa a mandar p_tipo. Removida para nao existirem duas versoes com
-- comportamentos diferentes.
drop function if exists public.admin_gerar_cobranca(uuid, date, numeric, date, text);
