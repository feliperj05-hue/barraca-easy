-- Barraca Easy — dados públicos do site comercial
-- Mantém planos e novidades no mesmo Supabase usado pelo aplicativo.

create or replace function public.catalogo_publico_planos()
returns table (
  codigo text,
  nome text,
  descricao text,
  descricao_comercial text,
  max_usuarios integer,
  valor_mensal numeric,
  taxa_implantacao numeric,
  ordem integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.codigo,
    p.nome,
    p.descricao,
    case p.codigo
      when 'plano_1' then 'Para começar só no caixa'
      when 'plano_2' then 'Para caixa e produção conectados'
      when 'plano_3' then 'Para equipes em crescimento'
      when 'plano_4' then 'Para operações maiores'
      else p.descricao
    end as descricao_comercial,
    p.max_usuarios,
    p.valor_mensal,
    p.taxa_implantacao,
    p.ordem
  from public.planos p
  where p.contratavel = true
  order by p.ordem;
$$;

revoke all on function public.catalogo_publico_planos() from public;
grant execute on function public.catalogo_publico_planos() to anon, authenticated;

create table if not exists public.product_updates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  categoria text not null check (categoria in ('Novidade', 'Melhoria', 'Correção', 'Em breve')),
  titulo text not null,
  resumo text not null,
  descricao_comercial text,
  publicado boolean not null default false,
  destaque boolean not null default false,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.product_updates enable row level security;

drop policy if exists product_updates_public_select on public.product_updates;
create policy product_updates_public_select on public.product_updates
  for select using (publicado = true);

drop policy if exists product_updates_admin_write on public.product_updates;
create policy product_updates_admin_write on public.product_updates
  for all using (public.is_plataforma_admin())
  with check (public.is_plataforma_admin());

grant select on public.product_updates to anon, authenticated;
grant insert, update, delete on public.product_updates to authenticated;

-- Conteúdo inicial comercial. Pode ser editado pelo painel administrativo no futuro.
insert into public.product_updates
  (slug, categoria, titulo, resumo, descricao_comercial, publicado, destaque, publicado_em)
values
  (
    'pedidos-mais-claros-producao',
    'Melhoria',
    'Pedidos mais claros para a produção',
    'Informações organizadas para facilitar a leitura dos itens, observações e andamento.',
    'A equipe de preparo encontra com mais facilidade o que precisa produzir e em qual etapa cada pedido está.',
    true,
    true,
    now()
  ),
  (
    'operacao-internet-instavel',
    'Melhoria',
    'Mais clareza durante oscilações de internet',
    'Identificação mais simples do que já foi sincronizado e do que ainda está aguardando.',
    'A operação consegue acompanhar as pendências e confirmar quando as informações voltam a ser enviadas.',
    true,
    false,
    now() - interval '1 minute'
  ),
  (
    'atendimento-automatico-totem',
    'Em breve',
    'Atendimento mais automático',
    'Estamos preparando o autoatendimento por totem integrado ao fluxo da produção.',
    'A proposta é reduzir etapas no caixa e permitir que o cliente inicie o pedido de forma autônoma.',
    true,
    false,
    now() - interval '2 minutes'
  )
on conflict (slug) do update set
  categoria = excluded.categoria,
  titulo = excluded.titulo,
  resumo = excluded.resumo,
  descricao_comercial = excluded.descricao_comercial,
  publicado = excluded.publicado,
  destaque = excluded.destaque,
  publicado_em = excluded.publicado_em,
  atualizado_em = now();
