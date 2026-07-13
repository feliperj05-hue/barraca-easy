-- Barraca Easy - Fase 1 SaaS (issue #32)
-- Migrar pedidos/producao para o Supabase, online-first.
--
-- RPC create_order: cria o pedido + seus itens numa unica transacao coerente
-- (se os itens falharem, nao sobra pedido orfao). A regra de senha unica por
-- dia ja e garantida no banco pelo indice parcial `pedidos_senha_dia_unica`
-- (da #28); aqui traduzimos a violacao (unique_violation) numa mensagem
-- amigavel para o caixa. Cancelado libera o numero (o indice ignora cancelados).
--
-- Status (aguardando/chamado/entregue/cancelado) e as transicoes ficam no
-- client via update direto (RLS `pedidos_all` ja restringe ao tenant).
-- Idempotente (create or replace).

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

revoke all on function public.create_order(uuid, text, text, numeric, jsonb) from public, anon;
grant execute on function public.create_order(uuid, text, text, numeric, jsonb) to authenticated;
