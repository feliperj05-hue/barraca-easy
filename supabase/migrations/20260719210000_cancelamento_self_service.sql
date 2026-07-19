-- Barraca Easy - Cancelamento self-service da assinatura (issue #115, epic #26)
--
-- O dono cancela SOZINHO, dentro do app, sem falar com ninguem. Decisao do
-- Felipe. A regra que o juridico cobra e "cancelar tem que ser tao simples
-- quanto contratar" — e simples de verdade, nao simples no discurso.
--
-- TRES DECISOES QUE VALE EXPLICAR, porque nao sao obvias:
--
-- 1. FLUXO UNICO para teste e para assinatura paga. Para quem esta saindo, a
--    intencao e a mesma. Dois caminhos na tela obrigariam o cliente a saber em
--    que situacao contratual ele esta ANTES de conseguir sair, e criariam dois
--    lugares para o link se perder. O que muda e o EFEITO, e quem decide o
--    efeito e este arquivo — nao a tela.
--
-- 2. ASSINATURA PAGA NAO E CORTADA NA HORA. A barraca continua funcionando ate
--    o fim do periodo que ja foi pago, e so depois vira cancelada. Cortar no
--    ato seria ficar com dinheiro de servico nao prestado — e ai a conversa
--    vira devolucao. Deixando rodar o que foi pago, NAO HA O QUE DEVOLVER no
--    caso comum. Isto e de proposito: o fluxo de estorno depende de posicao
--    juridica que ainda nao existe, e este arquivo foi desenhado para nao
--    precisar dela. (Nao resolve o arrependimento no mesmo dia — esse caso
--    segue em aberto.)
--
-- 3. TRILHA APPEND-ONLY. `assinatura_eventos` nao tem policy de update nem de
--    delete, para ninguem. Trilha que pode ser reescrita nao e trilha.
--
-- NAO ENTRA AQUI, de proposito: estorno/devolucao e pagamento automatico.
-- Pagamento automatico traria dado de pagamento de cliente final para dentro
-- do sistema, onde hoje nao existe nenhum — isso reabre o inventario LGPD
-- inteiro e passa pelo juridico antes.
--
-- Idempotente.


-- =====================================================================
-- 1. Estado do cancelamento no tenant
-- =====================================================================
--
-- `cancelamento_efetivo_em` e a data em que a barraca REALMENTE para. Enquanto
-- ela estiver no futuro, `status_assinatura` continua 'ativa' e o dono opera
-- normal. Guardar a data em vez de so um booleano e o que permite dizer na
-- tela, antes de confirmar, ate que dia vai funcionar.

alter table public.tenants add column if not exists cancelamento_pedido_em  timestamptz;
alter table public.tenants add column if not exists cancelamento_efetivo_em date;
alter table public.tenants add column if not exists cancelamento_pedido_por uuid references auth.users(id);

create index if not exists tenants_cancelamento_idx
  on public.tenants(cancelamento_efetivo_em)
  where cancelamento_efetivo_em is not null;

-- =====================================================================
-- 2. Trilha auditavel
-- =====================================================================
--
-- Responde as quatro perguntas do juridico: quem pediu, quando, de qual plano,
-- por qual tela. `email` e `plano_nome` ficam CONGELADOS no momento do evento:
-- se a pessoa trocar de e-mail ou o plano for renomeado depois, o registro
-- continua contando a historia como ela foi.

create table if not exists public.assinatura_eventos (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  tipo           text not null check (tipo in ('contratacao','cancelamento','reativacao')),
  -- quem pediu
  user_id        uuid references auth.users(id),
  email          text,
  -- de qual plano
  plano          text,
  plano_nome     text,
  valor_mensal   numeric(10,2),
  -- por qual tela
  origem         text,
  -- o que aconteceu
  status_antes   text,
  status_depois  text,
  efetivo_em     date,
  motivo         text,
  detalhe        jsonb,
  -- quando
  created_at     timestamptz not null default now()
);

create index if not exists assinatura_eventos_tenant_idx
  on public.assinatura_eventos(tenant_id, created_at desc);

alter table public.assinatura_eventos enable row level security;

-- Leitura: o dono ve a historia da propria barraca; o admin da plataforma ve
-- tudo (e ele quem precisa demonstrar que o cancelamento funcionou).
drop policy if exists assinatura_eventos_select on public.assinatura_eventos;
create policy assinatura_eventos_select on public.assinatura_eventos
  for select using (
    public.is_tenant_member(tenant_id) or public.is_plataforma_admin()
  );

-- Escrita: NENHUMA policy de insert/update/delete, de proposito. So as RPCs
-- `security definer` deste arquivo escrevem aqui. E o grant abaixo da apenas
-- SELECT — sem privilegio de tabela, nem uma RLS desligada por engano abriria
-- a porta para reescrever a trilha.
revoke all on public.assinatura_eventos from public, anon, authenticated;
grant select on public.assinatura_eventos to authenticated;

create or replace function public.registrar_evento_assinatura(
  p_tenant_id     uuid,
  p_tipo          text,
  p_origem        text,
  p_status_antes  text,
  p_status_depois text,
  p_efetivo_em    date default null,
  p_motivo        text default null,
  p_detalhe       jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_plano record;
begin
  select t.plano, p.nome as plano_nome, t.valor_mensal
    into v_plano
  from public.tenants t
  left join public.planos p on p.codigo = t.plano
  where t.id = p_tenant_id;

  insert into public.assinatura_eventos
    (tenant_id, tipo, user_id, email, plano, plano_nome, valor_mensal,
     origem, status_antes, status_depois, efetivo_em, motivo, detalhe)
  values
    (p_tenant_id, p_tipo, auth.uid(),
     (select u.email from auth.users u where u.id = auth.uid()),
     v_plano.plano, v_plano.plano_nome, v_plano.valor_mensal,
     -- origem sempre preenchida: evento sem tela de origem nao serve para
     -- demonstrar por onde o cliente conseguiu (ou nao) cancelar.
     coalesce(nullif(trim(p_origem), ''), 'desconhecida'),
     p_status_antes, p_status_depois, p_efetivo_em,
     nullif(trim(coalesce(p_motivo, '')), ''), p_detalhe)
  returning id into v_id;

  return v_id;
end;
$$;

-- =====================================================================
-- 3. Ate quando a barraca ja pagou
-- =====================================================================
--
-- Ultimo mes com mensalidade PAGA -> ultimo dia daquele mes. Nunca devolve
-- data no passado: se o periodo pago ja acabou, o cancelamento e imediato.
--
-- Null significa "nao ha periodo pago" (nunca pagou, ou so tem cobranca em
-- aberto). Nesse caso tambem e imediato — nao ha servico pago a preservar.

create or replace function public.fim_periodo_pago(t uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select max((date_trunc('month', c.competencia) + interval '1 month - 1 day')::date)
  from public.cobrancas c
  where c.tenant_id = t
    and c.tipo = 'mensalidade'
    and c.status = 'paga';
$$;

-- =====================================================================
-- 4. O portao de acesso passa a respeitar o cancelamento agendado
-- =====================================================================
--
-- Este e o ponto que faz o cancelamento VALER: `tenant_ativo` e usada pela RLS
-- e pelas RPCs de pedido. Alterar a coluna `status_assinatura` sozinha nao
-- bastaria, porque no cancelamento agendado ela continua 'ativa' de proposito.
--
-- Regra acrescentada: se existe data de cancelamento e ela ja passou, a
-- barraca nao esta mais ativa — mesmo que a coluna ainda diga 'ativa'. Assim o
-- corte acontece na data certa sem depender de nenhuma rotina agendada
-- rodando na hora certa (nao ha cron neste projeto).

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
      and (
        x.cancelamento_efetivo_em is null
        or x.cancelamento_efetivo_em >= current_date
      )
  );
$$;

-- =====================================================================
-- 5. Cancelar (a RPC que a tela chama)
-- =====================================================================
--
-- UM caminho para os dois casos. O que muda e o efeito:
--
--   teste     -> imediato. Nada foi cobrado, nada a devolver.
--   ativa     -> vale ate o fim do periodo ja pago; depois vira cancelada.
--   suspensa  -> imediato (ja nao operava).
--   cancelada -> nao faz nada e nao da erro (idempotente): quem clicou duas
--                vezes nao pode levar mensagem de falha.
--
-- Motivo e OPCIONAL. Exigir motivo para deixar sair e atrito disfarcado de
-- pesquisa, e transformaria o cancelamento em algo mais dificil que a
-- contratacao — exatamente o que a regra proibe.

create or replace function public.cancelar_minha_assinatura(
  p_tenant_id uuid,
  p_motivo    text default null,
  p_origem    text default 'app:configuracoes/minha-assinatura'
)
returns table (
  status_anterior   text,
  status_atual      text,
  imediato          boolean,
  efetivo_em        date,
  cobrancas_canceladas integer,
  evento_id         uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  public.tenants;
  v_fim     date;
  v_novo    text;
  v_efetivo date;
  v_qtd     integer := 0;
  v_evento  uuid;
begin
  -- So o DONO. Operador toca a fila do balcao; nao encerra o contrato da
  -- barraca. Mesma regra de `contratar_plano` — se contratar exige dono,
  -- cancelar exigir menos seria um buraco, e exigir mais seria dificultar a
  -- saida.
  if not public.is_tenant_owner(p_tenant_id) then
    raise exception 'Apenas o dono da barraca pode cancelar a assinatura.'
      using errcode = '42501';
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  if v_tenant.id is null then
    raise exception 'Barraca nao encontrada.' using errcode = 'P0002';
  end if;

  -- Ja cancelada: devolve o estado atual, sem erro e sem evento novo.
  if v_tenant.status_assinatura = 'cancelada' then
    return query select
      v_tenant.status_assinatura, v_tenant.status_assinatura, true,
      v_tenant.cancelamento_efetivo_em, 0, null::uuid;
    return;
  end if;

  if v_tenant.status_assinatura = 'ativa' then
    v_fim := public.fim_periodo_pago(p_tenant_id);
  else
    v_fim := null;  -- teste e suspensa saem na hora
  end if;

  if v_fim is not null and v_fim >= current_date then
    -- Continua operando ate o fim do que pagou. A coluna segue 'ativa' de
    -- proposito: e `tenant_ativo` quem corta na data.
    v_novo    := v_tenant.status_assinatura;
    v_efetivo := v_fim;
  else
    v_novo    := 'cancelada';
    v_efetivo := current_date;
  end if;

  update public.tenants
     set status_assinatura       = v_novo,
         cancelamento_pedido_em  = now(),
         cancelamento_pedido_por = auth.uid(),
         cancelamento_efetivo_em = v_efetivo
   where id = p_tenant_id;

  -- Cobranca em aberto e servico que ainda nao foi prestado nem pago. Depois
  -- do pedido de cancelamento, cobrar isso seria cobrar por nada.
  update public.cobrancas
     set status     = 'cancelada',
         observacao = coalesce(observacao || ' | ', '')
                      || 'Cancelada por pedido de cancelamento da assinatura (self-service)'
   where tenant_id = p_tenant_id
     and status = 'aberta';
  get diagnostics v_qtd = row_count;

  v_evento := public.registrar_evento_assinatura(
    p_tenant_id, 'cancelamento', p_origem,
    v_tenant.status_assinatura, v_novo, v_efetivo, p_motivo,
    jsonb_build_object(
      'imediato', v_efetivo <= current_date,
      'fim_periodo_pago', v_fim,
      'cobrancas_canceladas', v_qtd
    )
  );

  return query select
    v_tenant.status_assinatura, v_novo, v_efetivo <= current_date,
    v_efetivo, v_qtd, v_evento;
end;
$$;

-- =====================================================================
-- 6. Contratar tambem passa a registrar evento
-- =====================================================================
--
-- Sem os DOIS lados na trilha nao da para demonstrar a paridade que o
-- juridico cobra: precisa dar para comparar contratacao e cancelamento no
-- mesmo lugar, com o mesmo formato.
--
-- Aproveita e desfaz o cancelamento agendado: quem contrata de novo esta
-- voltando atras, e deixar a data la faria a barraca desligar sozinha depois.
--
-- Recriada por inteiro (o corpo mudou); a assinatura e o tipo de retorno
-- continuam identicos, entao `create or replace` basta.

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
  v_plano   public.planos;
  v_comp    date := date_trunc('month', current_date)::date;
  v_cob     public.cobrancas;
  v_setup   boolean := false;
  v_antes   text;
  v_reativa boolean;
begin
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

  select status_assinatura,
         (status_assinatura = 'cancelada' or cancelamento_efetivo_em is not null)
    into v_antes, v_reativa
  from public.tenants where id = p_tenant_id;

  update public.tenants
     set plano        = v_plano.codigo,
         valor_mensal = v_plano.valor_mensal,
         -- Voltou atras: limpa o cancelamento agendado, senao a barraca
         -- desligaria sozinha depois de o dono ter contratado de novo.
         cancelamento_pedido_em  = null,
         cancelamento_efetivo_em = null,
         cancelamento_pedido_por = null,
         -- Barraca cancelada que contrata de novo volta para 'teste' e passa
         -- pelo caminho normal de baixa manual. Nao volta 'ativa' sozinha:
         -- ninguem fica ativo sem alguem confirmar que o dinheiro entrou.
         status_assinatura = case when status_assinatura = 'cancelada'
                                  then 'teste' else status_assinatura end
   where id = p_tenant_id;

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

  perform public.registrar_evento_assinatura(
    p_tenant_id,
    case when v_reativa then 'reativacao' else 'contratacao' end,
    'app:configuracoes/minha-assinatura',
    v_antes,
    (select status_assinatura from public.tenants where id = p_tenant_id),
    null, null,
    jsonb_build_object(
      'plano_escolhido', v_plano.codigo,
      'cobranca_id', v_cob.id,
      'setup_gerado', v_setup
    )
  );

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
-- 7. `minha_assinatura` conta o estado do cancelamento
-- =====================================================================
--
-- A tela precisa dizer, ANTES de o dono confirmar, ate que dia a barraca vai
-- funcionar. E depois de cancelado precisa mostrar que esta cancelado, mesmo
-- quando a coluna ainda diz 'ativa' porque o periodo pago nao acabou.
--
-- O retorno GANHOU COLUNAS. O Postgres recusa `create or replace` que muda o
-- tipo de retorno ("cannot change return type of existing function"), entao o
-- drop explicito e obrigatorio. Isso ja mordeu neste repo na #94.

drop function if exists public.minha_assinatura(uuid);

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
  proximo_vencimento date,
  cancelamento_pedido_em  timestamptz,
  cancelamento_efetivo_em date,
  fim_periodo_pago        date
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
      where c.tenant_id = t.id and c.status = 'aberta'),
    t.cancelamento_pedido_em,
    t.cancelamento_efetivo_em,
    public.fim_periodo_pago(t.id)
  from public.tenants t
  left join public.planos p on p.codigo = t.plano
  where t.id = p_tenant_id
    and public.is_tenant_member(t.id);
$$;

-- =====================================================================
-- 8. Faxina opcional do status
-- =====================================================================
--
-- `tenant_ativo` ja corta o acesso na data certa, entao NADA depende desta
-- funcao para o cancelamento valer. Ela existe so para a coluna
-- `status_assinatura` alcancar a realidade e os relatorios do admin nao
-- mostrarem 'ativa' em barraca que ja parou. Pode ser chamada a mao ou por
-- agendador, se um dia existir um.

create or replace function public.aplicar_cancelamentos_vencidos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;

  update public.tenants
     set status_assinatura = 'cancelada'
   where cancelamento_efetivo_em is not null
     and cancelamento_efetivo_em < current_date
     and status_assinatura <> 'cancelada';
  get diagnostics v_qtd = row_count;

  return v_qtd;
end;
$$;

-- =====================================================================
-- 9. Grants
-- =====================================================================
--
-- `registrar_evento_assinatura` NAO e concedida a ninguem: e ferramenta
-- interna das RPCs acima. Se o cliente pudesse chamar, poderia inventar
-- registro na trilha — e trilha que o auditado escreve a vontade nao vale
-- nada.

revoke all on function public.registrar_evento_assinatura(uuid, text, text, text, text, date, text, jsonb) from public, anon, authenticated;
revoke all on function public.cancelar_minha_assinatura(uuid, text, text) from public, anon;
revoke all on function public.fim_periodo_pago(uuid)                      from public, anon;
revoke all on function public.aplicar_cancelamentos_vencidos()            from public, anon;
revoke all on function public.minha_assinatura(uuid)                      from public, anon;

grant execute on function public.cancelar_minha_assinatura(uuid, text, text) to authenticated;
grant execute on function public.fim_periodo_pago(uuid)                      to authenticated;
grant execute on function public.aplicar_cancelamentos_vencidos()            to authenticated;
grant execute on function public.minha_assinatura(uuid)                      to authenticated;

