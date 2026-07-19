-- Barraca Easy - Teste de 7 dias visivel + contratacao pelo dono (issue #96)
--
-- CONTEXTO: o Felipe achou que havia furo (pessoa nova entrando liberada) e
-- depois confirmou que nao — ela entrou em PERIODO DE TESTE, que e o
-- comportamento desejado. Cadastro novo continua LIVRE, sem aprovacao de
-- ninguem. Nada aqui trava quem quer se cadastrar.
--
-- O que o susto revelou: o cliente nao sabe que esta em teste. Se nem o dono
-- do produto percebeu olhando o app, o cliente tambem nao percebe.
--
-- NADA AQUI E RETROATIVO. A barraca "Felipe teste" e a conta ja criada nao
-- sao tocadas: as mudancas de entrada valem em `before insert`, e nao ha
-- nenhum `update` de dado existente. Quem esta com 30 dias mantem os 30.
--
-- Idempotente.

-- =====================================================================
-- 1. Teste passa a ser de 7 dias
-- =====================================================================
-- Afeta apenas cadastros NOVOS (e default de coluna).

alter table public.tenants alter column teste_expira_em set default (current_date + 7);

-- =====================================================================
-- 2. Configuracao da plataforma (chave Pix)
-- =====================================================================
--
-- No banco, e nao em variavel de ambiente, por um motivo pratico: o Felipe
-- ainda nao tem QR Code e vai querer trocar a chave depois. Em env var, cada
-- troca exige mexer na configuracao do GitHub e republicar o app. Aqui e um
-- update — e da para editar pelo painel no futuro.

create table if not exists public.plataforma_config (
  chave      text primary key,
  valor      text,
  atualizado timestamptz not null default now()
);

alter table public.plataforma_config enable row level security;

-- Todo mundo logado le (o dono precisa ver como pagar); so o admin escreve.
drop policy if exists plataforma_config_select on public.plataforma_config;
create policy plataforma_config_select on public.plataforma_config
  for select using (auth.uid() is not null);

drop policy if exists plataforma_config_write on public.plataforma_config;
create policy plataforma_config_write on public.plataforma_config
  for all using (public.is_plataforma_admin())
  with check (public.is_plataforma_admin());

grant select on public.plataforma_config to authenticated;
grant insert, update on public.plataforma_config to authenticated;

-- Chave informada pelo Felipe. `do update` para reaplicar se ele trocar
-- depois direto na tabela sem perder a linha.
insert into public.plataforma_config (chave, valor)
values
  ('pix_chave', 'freire_rj@yahoo.com.br'),
  ('pix_nome', 'Barraca Easy')
on conflict (chave) do nothing;

-- =====================================================================
-- 3. Dois caminhos que deixavam BURLAR o teste
-- =====================================================================
--
-- Nenhum dos dois impede alguem de se cadastrar. Os dois impedem passar por
-- FORA da regra — que e o requisito "limite valendo no banco, nao so na tela".

-- (a) Dava para criar barraca ja ATIVA pela API.
--
-- `tenants_insert` libera qualquer autenticado a inserir, e o GRANT de insert
-- vale para TODAS as colunas. Na #89 eu restringi o UPDATE a (nome, slug)
-- para o dono nao se auto-ativar, mas esqueci do INSERT:
--
--   supabase.from('tenants').insert({ nome: 'x', status_assinatura: 'ativa' })
--
-- Isso e assinatura vitalicia de graca e faria o teste de 7 dias virar
-- enfeite. Mesma cerca do UPDATE: quem cria so escolhe o nome.
revoke insert on public.tenants from authenticated;
grant  insert (nome, slug) on public.tenants to authenticated;

-- (b) Qualquer usuario podia se vincular a QUALQUER barraca.
--
-- A policy terminava em `or user_id = auth.uid()`, o que permitia:
--
--   supabase.from('membros').insert({ tenant_id: '<uuid alheio>',
--                                     user_id: meuId, papel: 'dono' })
--
-- Alem de furar o limite de usuarios, isso e quebra de isolamento
-- multi-tenant: virar dono da barraca dos outros. A clausula existia como
-- bootstrap do onboarding e e DESNECESSARIA — `create_tenant_with_owner` e
-- SECURITY DEFINER e insere o vinculo por cima da RLS. Nenhum ponto do client
-- insere em `membros` direto (conferido no codigo).
drop policy if exists membros_insert on public.membros;
create policy membros_insert on public.membros
  for insert with check (
    public.is_tenant_owner(tenant_id) and public.cabe_mais_um_usuario(tenant_id)
  );

-- =====================================================================
-- 4. Cadastro novo nasce no Plano 1, em teste — e entra na hora
-- =====================================================================
--
-- Hoje o tenant novo cai no plano legado `gratis`, que tem max_usuarios NULL
-- = SEM LIMITE de usuarios durante o teste. O legado existe para nao punir
-- quem ja estava; nao para receber cadastro novo.
--
-- O trigger fecha TODOS os caminhos de criacao de uma vez (a RPC de
-- onboarding, um insert direto, qualquer coisa futura), em vez de depender de
-- cada chamador lembrar de preencher certo.
--
-- O que ele NAO faz: barrar, exigir aprovacao, atrasar. A barraca e criada
-- normalmente, na hora, e ja sai operando.

create or replace function public.tenant_entrada_padrao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano text;
begin
  -- Plano de entrada: o menor plano contratavel (hoje Plano 1). Sai de
  -- consulta e nao de constante para uma mudanca de tabela de precos nao
  -- exigir editar esta funcao.
  select codigo into v_plano
  from public.planos
  where contratavel
  order by ordem
  limit 1;

  -- Cadastro novo nunca nasce no legado nem num plano que nao existe.
  if new.plano is null
     or new.plano not in (select codigo from public.planos where contratavel)
  then
    new.plano := coalesce(v_plano, new.plano);
  end if;

  -- E nunca nasce ativo: entrada e sempre teste com prazo.
  if new.status_assinatura is null or new.status_assinatura <> 'teste' then
    new.status_assinatura := 'teste';
  end if;

  if new.teste_expira_em is null then
    new.teste_expira_em := current_date + 7;
  end if;

  -- Preco de vitrine do plano de entrada, para o painel nao mostrar R$ 0.
  if coalesce(new.valor_mensal, 0) = 0 then
    new.valor_mensal := coalesce(
      (select valor_mensal from public.planos where codigo = new.plano), 0);
  end if;

  return new;
end;
$$;

drop trigger if exists tenants_entrada_padrao on public.tenants;
create trigger tenants_entrada_padrao
  before insert on public.tenants
  for each row execute function public.tenant_entrada_padrao();

-- =====================================================================
-- 5. Admin estende o teste pelo painel
-- =====================================================================
--
-- Soma a partir da data que for MAIOR (hoje ou o fim atual). Estender um
-- teste ja vencido deve dar dias de verdade a partir de hoje, nao ressuscitar
-- um prazo que ficou para tras.

create or replace function public.admin_estender_teste(
  p_tenant_id uuid,
  p_dias      integer default 7
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.tenants;
  v_base date;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;

  if p_dias is null or p_dias <= 0 then
    raise exception 'Informe um numero de dias maior que zero.';
  end if;

  select greatest(coalesce(teste_expira_em, current_date), current_date)
    into v_base
  from public.tenants where id = p_tenant_id;

  if v_base is null then
    raise exception 'Barraca nao encontrada.';
  end if;

  update public.tenants
     set teste_expira_em   = v_base + p_dias,
         status_assinatura = 'teste'
   where id = p_tenant_id
   returning * into v;

  return v;
end;
$$;

-- =====================================================================
-- 6. O DONO contrata plano sozinho, a qualquer momento
-- =====================================================================
--
-- Contratar aqui e MANIFESTACAO DE INTERESSE, nao cobranca automatica:
--   - troca o plano (e o limite de usuarios junto);
--   - gera/atualiza a cobranca em aberto do mes;
--   - NAO ativa a assinatura.
--
-- A ativacao continua vindo da baixa manual do Felipe (`admin_baixar_cobranca`),
-- que ja religa a barraca quando nao sobra nada em aberto. Ou seja: o dono
-- escolhe e paga por fora; quem confirma o dinheiro e uma pessoa.
--
-- Por que atualizar a cobranca do mes em vez de criar outra: sem isso, trocar
-- de plano tres vezes no mesmo mes geraria tres mensalidades (e o indice
-- unico nem deixaria). O dono acabaria devendo o que nao combinou.

create or replace function public.contratar_plano(
  p_tenant_id uuid,
  p_plano     text
)
returns table (
  plano            text,
  valor_mensal     numeric,
  max_usuarios     integer,
  usuarios_atuais  integer,
  cobranca_id      uuid,
  valor_cobrado    numeric,
  setup_gerado     boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano  public.planos;
  v_comp   date := date_trunc('month', current_date)::date;
  v_cob    public.cobrancas;
  v_setup  boolean := false;
begin
  -- So o DONO da propria barraca. Operador nao contrata plano.
  if not public.is_tenant_owner(p_tenant_id) then
    raise exception 'Apenas o dono da barraca pode contratar um plano.'
      using errcode = '42501';
  end if;

  select * into v_plano
  from public.planos
  where codigo = p_plano and contratavel;

  if v_plano.codigo is null then
    raise exception 'Plano indisponivel: %', p_plano;
  end if;

  update public.tenants
     set plano        = v_plano.codigo,
         valor_mensal = v_plano.valor_mensal
   where id = p_tenant_id;

  -- Mensalidade do mes: uma so. Se ja existe em aberto, corrige o valor.
  select * into v_cob
  from public.cobrancas
  where tenant_id = p_tenant_id
    and tipo = 'mensalidade'
    and competencia = v_comp
    and status = 'aberta';

  if v_cob.id is null then
    insert into public.cobrancas
      (tenant_id, competencia, valor, vencimento, status, tipo, metodo,
       observacao, criada_por)
    values
      (p_tenant_id, v_comp, v_plano.valor_mensal, v_comp + 9, 'aberta',
       'mensalidade', 'pix_manual',
       'Plano escolhido pelo dono no app', auth.uid())
    returning * into v_cob;
  else
    update public.cobrancas
       set valor      = v_plano.valor_mensal,
           observacao = 'Plano alterado pelo dono no app'
     where id = v_cob.id
     returning * into v_cob;
  end if;

  -- Taxa de implantacao: uma vez na vida da barraca (o indice unico parcial
  -- e a garantia real; o if evita levantar excecao a toa).
  if v_plano.taxa_implantacao > 0 then
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
        (p_tenant_id, v_comp, v_plano.taxa_implantacao, current_date + 9,
         'aberta', 'implantacao', 'pix_manual',
         'Taxa de implantação (cobrança única)', auth.uid());
      v_setup := true;
    end if;
  end if;

  return query select
    v_plano.codigo,
    v_plano.valor_mensal,
    v_plano.max_usuarios,
    public.usuarios_no_tenant(p_tenant_id),
    v_cob.id,
    v_cob.valor,
    v_setup;
end;
$$;

-- =====================================================================
-- 7. Grants
-- =====================================================================
revoke all on function public.admin_estender_teste(uuid, integer) from public, anon;
revoke all on function public.contratar_plano(uuid, text)          from public, anon;

grant execute on function public.admin_estender_teste(uuid, integer) to authenticated;
grant execute on function public.contratar_plano(uuid, text)          to authenticated;
