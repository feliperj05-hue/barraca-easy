-- Barraca Easy - Fase 1 SaaS (issue #31)
-- Migrar o cardapio (produtos) para o Supabase, online-first.
--
-- A UI da tela Cardapio distingue itens "Padrao" (vindos do seed) de itens
-- "Criado por voce": os padrao so podem ser reprecificados/ocultados, os
-- custom podem ser editados/removidos. Para preservar esse comportamento na
-- nuvem, marcamos a origem com a coluna `seed`.
--
-- Os produtos padrao sao semeados por tenant a partir do unico source no
-- codigo (DEFAULT_PRODUCTS), no onboarding e defensivamente quando o cardapio
-- do tenant estiver vazio. Idempotente.

alter table public.produtos
  add column if not exists seed boolean not null default false;

create index if not exists produtos_tenant_seed_idx
  on public.produtos (tenant_id, seed);
