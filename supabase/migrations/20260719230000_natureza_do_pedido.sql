-- Barraca Easy - Natureza do pedido de saida (issue #122, epic #26)
--
-- A LACUNA QUE ISTO FECHA.
--
-- O #115 entregou UMA porta de saida, e ela se comporta como RESILICAO para
-- todo mundo: "para daqui pra frente, o que ja foi pago fica rodando ate o
-- fim". Para o caso comum isso resolve e nao ha o que devolver.
--
-- So que existe um segundo caso, e ele nao e a mesma coisa: ARREPENDIMENTO —
-- desfazer a contratacao dentro da janela de reflexao. Quem se arrepende nao
-- quer mais 28 dias de acesso; quer o dinheiro. Trocar devolucao por acesso
-- prolongado atende o primeiro caso e deixa o segundo descoberto.
--
-- E aqui esta o ponto pratico: a trilha grava QUE houve cancelamento, mas nao
-- grava QUAL DOS DOIS foi. Depois ninguem prova — inclusive o Felipe, que e
-- justamente quem precisaria da prova de que o cliente pediu resilicao e nao
-- desistencia. Registrar a natureza e barato agora e caro depois, porque
-- depois nao da pra reconstituir intencao de um evento passado.
--
-- O QUE ESTE ARQUIVO **NAO** FAZ, DE PROPOSITO:
--
--   - nao constroi devolucao/estorno (prazo e forma seguem com o advogado);
--   - nao chumba prazo legal nenhum no codigo. Em vez de gravar a CONCLUSAO
--     ("estava na janela"), grava o FATO OBJETIVO (quando contratou, quantos
--     dias se passaram). Assim, quando o prazo for fixado — 7 dias, 14, o que
--     for —, ele se aplica aos eventos ja gravados sem precisar de migration
--     nem de dado que ninguem guardou.
--
-- Idempotente.


-- =====================================================================
-- 1. A coluna
-- =====================================================================
--
-- NULL = o cliente nao declarou. Nao ha backfill de proposito: carimbar
-- 'resilicao' nos eventos antigos seria inventar uma declaracao que ninguem
-- fez — e trilha que inventa declaracao e pior que trilha incompleta.

alter table public.assinatura_eventos
  add column if not exists natureza text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assinatura_eventos_natureza_ck'
  ) then
    alter table public.assinatura_eventos
      add constraint assinatura_eventos_natureza_ck
      check (natureza is null or natureza in ('resilicao', 'arrependimento'));
  end if;
end
$$;

comment on column public.assinatura_eventos.natureza is
  'Natureza DECLARADA pelo cliente no pedido de saida: resilicao (parar daqui pra frente) ou arrependimento (desfazer a contratacao). NULL = nao declarada. E declaracao, nao classificacao juridica — quem qualifica e o advogado, com os dias objetivos gravados em `detalhe`.';

-- =====================================================================
-- 2. Quando esta barraca contratou
-- =====================================================================
--
-- A propria trilha e a melhor fonte: o evento de contratacao/reativacao mais
-- RECENTE, porque a janela de reflexao conta da contratacao que esta valendo,
-- nao da primeira de todas. Sem evento (barraca anterior ao #115), cai para
-- `tenants.created_at`, que e pior mas e honesto — e por isso o dado vai para
-- a trilha marcado como aproximado.

create or replace function public.contratacao_vigente_em(t uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select max(e.created_at)
       from public.assinatura_eventos e
      where e.tenant_id = t
        and e.tipo in ('contratacao', 'reativacao')),
    (select x.created_at from public.tenants x where x.id = t)
  );
$$;

-- =====================================================================
-- 3. `registrar_evento_assinatura` aprende a natureza
-- =====================================================================
--
-- Ganhou parametro no fim, com default. Drop explicito da assinatura antiga
-- para nao ficar overload: com duas versoes vivas, uma chamada por nome vira
-- ambigua e o PostgREST erra na cara do cliente.

drop function if exists public.registrar_evento_assinatura(uuid, text, text, text, text, date, text, jsonb);

create or replace function public.registrar_evento_assinatura(
  p_tenant_id     uuid,
  p_tipo          text,
  p_origem        text,
  p_status_antes  text,
  p_status_depois text,
  p_efetivo_em    date default null,
  p_motivo        text default null,
  p_detalhe       jsonb default null,
  p_natureza      text default null
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
     origem, status_antes, status_depois, efetivo_em, motivo, detalhe, natureza)
  values
    (p_tenant_id, p_tipo, auth.uid(),
     (select u.email from auth.users u where u.id = auth.uid()),
     v_plano.plano, v_plano.plano_nome, v_plano.valor_mensal,
     coalesce(nullif(trim(p_origem), ''), 'desconhecida'),
     p_status_antes, p_status_depois, p_efetivo_em,
     nullif(trim(coalesce(p_motivo, '')), ''), p_detalhe,
     nullif(trim(coalesce(p_natureza, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;

-- =====================================================================
-- 4. `cancelar_minha_assinatura` recebe e grava a natureza
-- =====================================================================
--
-- O EFEITO NAO MUDA. Arrependimento declarado ainda encerra pelo mesmo
-- caminho e ainda respeita o periodo pago — porque a devolucao nao existe e
-- inventar meia devolucao aqui seria pior do que nao ter. O que muda e que o
-- pedido passa a ficar REGISTRADO pelo que ele e, e o admin passa a conseguir
-- ver que aquele cliente pediu desistencia, com quantos dias de contrato.
--
-- Quem chamar sem informar natureza continua funcionando igual (default
-- 'resilicao', que e o comportamento que a porta unica sempre teve). Valor
-- desconhecido nao levanta erro: vira NULL. Ninguem pode ficar preso na
-- assinatura porque mandou uma string errada no caminho de SAIDA.
--
-- Drop obrigatorio: a assinatura ganhou parametro e o retorno ganhou coluna
-- ("cannot change return type of existing function"). Ja mordeu na #94.

drop function if exists public.cancelar_minha_assinatura(uuid, text, text);

create or replace function public.cancelar_minha_assinatura(
  p_tenant_id uuid,
  p_motivo    text default null,
  p_origem    text default 'app:configuracoes/minha-assinatura',
  p_natureza  text default 'resilicao'
)
returns table (
  status_anterior   text,
  status_atual      text,
  imediato          boolean,
  efetivo_em        date,
  cobrancas_canceladas integer,
  evento_id         uuid,
  natureza          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant     public.tenants;
  v_fim        date;
  v_novo       text;
  v_efetivo    date;
  v_qtd        integer := 0;
  v_evento     uuid;
  v_natureza   text;
  v_contratou  timestamptz;
  v_dias       integer;
  v_aprox      boolean;
begin
  if not public.is_tenant_owner(p_tenant_id) then
    raise exception 'Apenas o dono da barraca pode cancelar a assinatura.'
      using errcode = '42501';
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  if v_tenant.id is null then
    raise exception 'Barraca nao encontrada.' using errcode = 'P0002';
  end if;

  v_natureza := lower(nullif(trim(coalesce(p_natureza, '')), ''));
  if v_natureza not in ('resilicao', 'arrependimento') then
    v_natureza := null;
  end if;

  if v_tenant.status_assinatura = 'cancelada' then
    return query select
      v_tenant.status_assinatura, v_tenant.status_assinatura, true,
      v_tenant.cancelamento_efetivo_em, 0, null::uuid, null::text;
    return;
  end if;

  if v_tenant.status_assinatura = 'ativa' then
    v_fim := public.fim_periodo_pago(p_tenant_id);
  else
    v_fim := null;
  end if;

  if v_fim is not null and v_fim >= current_date then
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

  update public.cobrancas
     set status     = 'cancelada',
         observacao = coalesce(observacao || ' | ', '')
                      || 'Cancelada por pedido de cancelamento da assinatura (self-service)'
   where tenant_id = p_tenant_id
     and status = 'aberta';
  get diagnostics v_qtd = row_count;

  -- O FATO OBJETIVO, nao a conclusao juridica. Guardar so "arrependimento" e
  -- inutil sem saber de quando era o contrato; guardar os dias permite aplicar
  -- depois qualquer prazo que o advogado fixar, sobre eventos ja gravados.
  v_contratou := public.contratacao_vigente_em(p_tenant_id);
  v_dias      := (current_date - v_contratou::date);
  v_aprox     := not exists (
    select 1 from public.assinatura_eventos e
     where e.tenant_id = p_tenant_id
       and e.tipo in ('contratacao', 'reativacao')
  );

  v_evento := public.registrar_evento_assinatura(
    p_tenant_id, 'cancelamento', p_origem,
    v_tenant.status_assinatura, v_novo, v_efetivo, p_motivo,
    jsonb_build_object(
      'imediato', v_efetivo <= current_date,
      'fim_periodo_pago', v_fim,
      'cobrancas_canceladas', v_qtd,
      -- daqui pra baixo: materia-prima para qualificar o pedido depois
      'natureza_declarada', v_natureza,
      'natureza_enviada', p_natureza,
      'contratacao_em', v_contratou,
      'contratacao_aproximada', v_aprox,
      'dias_desde_contratacao', v_dias,
      'houve_pagamento', exists (
        select 1 from public.cobrancas c
         where c.tenant_id = p_tenant_id and c.status = 'paga'
      )
    ),
    v_natureza
  );

  return query select
    v_tenant.status_assinatura, v_novo, v_efetivo <= current_date,
    v_efetivo, v_qtd, v_evento, v_natureza;
end;
$$;

-- =====================================================================
-- 5. Grants
-- =====================================================================

revoke all on function public.registrar_evento_assinatura(uuid, text, text, text, text, date, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.cancelar_minha_assinatura(uuid, text, text, text) from public, anon;
revoke all on function public.contratacao_vigente_em(uuid)                      from public, anon;

grant execute on function public.cancelar_minha_assinatura(uuid, text, text, text) to authenticated;
grant execute on function public.contratacao_vigente_em(uuid)                      to authenticated;
