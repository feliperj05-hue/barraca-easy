-- Barraca Easy - RLS separando DONO de OPERADOR (issue #99)
--
-- O QUE ESTAVA ERRADO
--
-- As policies de escrita de `produtos`, `pedidos`, `pedido_itens` e
-- `fechamentos` usavam `public.pode_operar(tenant_id)`, que significa apenas
-- "e membro do tenant e a assinatura esta ativa". Papel nenhum era olhado.
--
-- Ou seja: a regra de que operador nao edita cardapio, nao ve fechamento e
-- nao fecha caixa existia SO na tela (`src/services/permissions.js` esconde
-- as opcoes). No banco, um operador autenticado batendo direto na API do
-- Supabase conseguia apagar produto, mudar preco, apagar pedido (DELETE
-- fisico, nao cancelamento) e ler/alterar/apagar fechamento.
--
-- Esconder botao nao e permissao. A trava tem que estar no banco — mesma
-- postura ja adotada no #89 e no #94 para o limite de usuarios do plano.
--
-- O que NAO estava errado: o isolamento entre barracas. Toda policy sempre
-- filtrou por tenant_id, e isso continua igual aqui. O furo era dentro da
-- propria barraca.
--
-- DESENHO DAS PERMISSOES
--
--   produtos       SELECT: qualquer membro (o operador precisa do cardapio
--                          para vender)
--                  INSERT/UPDATE/DELETE: so dono
--
--   pedidos        SELECT: qualquer membro
--                  INSERT/UPDATE: qualquer membro (e o trabalho do balcao:
--                          lancar pedido, chamar senha, entregar, cancelar —
--                          cancelar e UPDATE de status, nao DELETE)
--                  DELETE: so dono (o unico DELETE do app e o clearOrders do
--                          fechamento de caixa, que ja e tela de dono)
--
--   pedido_itens   igual a pedidos
--
--   fechamentos    tudo so dono, inclusive SELECT: fechamento e faturamento,
--                  e a tabela de permissoes mostrada ao dono promete que o
--                  operador nao ve.
--
-- Idempotente.

-- =====================================================================
-- 1. Helper: dono E com assinatura em dia
-- =====================================================================
--
-- `is_tenant_owner` sozinho nao basta nas policies de escrita: a barraca
-- suspensa por inadimplencia le mas nao escreve, e essa regra vale para o
-- dono tambem. Este helper e o par de `pode_operar`, so que exigindo o papel.

create or replace function public.pode_administrar(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_tenant_owner(t) and public.tenant_ativo(t);
$$;

grant execute on function public.pode_administrar(uuid) to authenticated;

-- =====================================================================
-- 2. produtos: operador le, dono escreve
-- =====================================================================

drop policy if exists produtos_all    on public.produtos;
drop policy if exists produtos_select on public.produtos;
drop policy if exists produtos_insert on public.produtos;
drop policy if exists produtos_update on public.produtos;
drop policy if exists produtos_delete on public.produtos;

create policy produtos_select on public.produtos
  for select using (public.is_tenant_member(tenant_id));

create policy produtos_insert on public.produtos
  for insert with check (public.pode_administrar(tenant_id));

create policy produtos_update on public.produtos
  for update using (public.pode_administrar(tenant_id))
          with check (public.pode_administrar(tenant_id));

create policy produtos_delete on public.produtos
  for delete using (public.pode_administrar(tenant_id));

-- =====================================================================
-- 3. pedidos e pedido_itens: operador opera, so dono apaga
-- =====================================================================

drop policy if exists pedidos_all    on public.pedidos;
drop policy if exists pedidos_select on public.pedidos;
drop policy if exists pedidos_insert on public.pedidos;
drop policy if exists pedidos_update on public.pedidos;
drop policy if exists pedidos_delete on public.pedidos;

create policy pedidos_select on public.pedidos
  for select using (public.is_tenant_member(tenant_id));

create policy pedidos_insert on public.pedidos
  for insert with check (public.pode_operar(tenant_id));

create policy pedidos_update on public.pedidos
  for update using (public.pode_operar(tenant_id))
          with check (public.pode_operar(tenant_id));

create policy pedidos_delete on public.pedidos
  for delete using (public.pode_administrar(tenant_id));

drop policy if exists pedido_itens_all    on public.pedido_itens;
drop policy if exists pedido_itens_select on public.pedido_itens;
drop policy if exists pedido_itens_insert on public.pedido_itens;
drop policy if exists pedido_itens_update on public.pedido_itens;
drop policy if exists pedido_itens_delete on public.pedido_itens;

create policy pedido_itens_select on public.pedido_itens
  for select using (public.is_tenant_member(tenant_id));

create policy pedido_itens_insert on public.pedido_itens
  for insert with check (public.pode_operar(tenant_id));

create policy pedido_itens_update on public.pedido_itens
  for update using (public.pode_operar(tenant_id))
          with check (public.pode_operar(tenant_id));

create policy pedido_itens_delete on public.pedido_itens
  for delete using (public.pode_administrar(tenant_id));

-- =====================================================================
-- 4. fechamentos: so dono, inclusive para ler
-- =====================================================================

drop policy if exists fechamentos_all    on public.fechamentos;
drop policy if exists fechamentos_select on public.fechamentos;
drop policy if exists fechamentos_insert on public.fechamentos;
drop policy if exists fechamentos_update on public.fechamentos;
drop policy if exists fechamentos_delete on public.fechamentos;

-- SELECT usa `is_tenant_owner` puro, sem `tenant_ativo`: a barraca suspensa
-- continua enxergando o proprio historico (regra do #89 — nao sequestramos o
-- dado do cliente, so travamos a operacao).
create policy fechamentos_select on public.fechamentos
  for select using (public.is_tenant_owner(tenant_id));

create policy fechamentos_insert on public.fechamentos
  for insert with check (public.pode_administrar(tenant_id));

create policy fechamentos_update on public.fechamentos
  for update using (public.pode_administrar(tenant_id))
          with check (public.pode_administrar(tenant_id));

create policy fechamentos_delete on public.fechamentos
  for delete using (public.pode_administrar(tenant_id));
