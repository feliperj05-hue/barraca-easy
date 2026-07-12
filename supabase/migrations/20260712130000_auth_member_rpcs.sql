-- Barraca Easy - Fase 1 SaaS (issue #29)
-- RPCs de gestao de membros. Complementam o schema/RLS da #28.
-- Idempotente (create or replace).

-- ---------------------------------------------------------------------
-- add_member: o DONO vincula um usuario JA EXISTENTE (por e-mail) ao seu
-- tenant, com um papel. O operador precisa ter criado a conta antes
-- (auth.users). SECURITY DEFINER para poder olhar auth.users e inserir
-- em membros; valida que quem chama e dono do tenant informado.
-- ---------------------------------------------------------------------
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

  insert into public.membros (tenant_id, user_id, papel)
  values (p_tenant_id, v_user_id, p_papel)
  on conflict (tenant_id, user_id) do update set papel = excluded.papel
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_member(uuid, text, text) from public, anon;
grant execute on function public.add_member(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- list_tenant_members: lista os membros do tenant COM e-mail. auth.users
-- nao e legivel via RLS pelo client, entao expomos so o necessario, e so
-- para quem e membro do tenant.
-- ---------------------------------------------------------------------
create or replace function public.list_tenant_members(p_tenant_id uuid)
returns table (user_id uuid, email text, papel text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  return query
    select m.user_id, u.email::text, m.papel, m.created_at
    from public.membros m
    join auth.users u on u.id = m.user_id
    where m.tenant_id = p_tenant_id
    order by m.created_at;
end;
$$;

revoke all on function public.list_tenant_members(uuid) from public, anon;
grant execute on function public.list_tenant_members(uuid) to authenticated;
