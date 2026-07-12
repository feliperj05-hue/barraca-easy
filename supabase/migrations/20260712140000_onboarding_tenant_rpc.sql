-- Barraca Easy - Fase 1 SaaS (issue #30)
-- Onboarding minimo: criar a barraca gera o TENANT e o vinculo do DONO
-- numa unica transacao coerente. Substitui os dois inserts client-side
-- de authService.createTenantAsOwner (tenant + membros, antes nao-atomicos).
-- Idempotente (create or replace).

-- ---------------------------------------------------------------------
-- create_tenant_with_owner: o usuario logado cria uma barraca e ja fica
-- vinculado como dono. Roda como uma unica funcao => uma unica transacao:
-- se qualquer passo falhar, nada e persistido (nao sobra tenant orfao).
-- SECURITY DEFINER para inserir tenant + membros ignorando o RLS, mas
-- amarrando o vinculo sempre em auth.uid() (o proprio chamador).
-- ---------------------------------------------------------------------
create or replace function public.create_tenant_with_owner(p_nome text)
returns table (id uuid, nome text)
language plpgsql
security definer
set search_path = public
as $FUNC$
declare
  v_uid  uuid := auth.uid();
  v_nome text := trim(coalesce(p_nome, ''));
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'Sessao invalida: faca login para criar uma barraca.'
      using errcode = '42501';
  end if;

  if v_nome = '' then
    raise exception 'Informe o nome da barraca.' using errcode = '22023';
  end if;

  -- Fase 1 assume 1 tenant por usuario (loadMembership pega o primeiro).
  -- Evita criar barracas orfas caso o onboarding seja chamado 2x.
  if exists (select 1 from public.membros m where m.user_id = v_uid) then
    raise exception 'Voce ja pertence a uma barraca.' using errcode = '42710';
  end if;

  insert into public.tenants (nome)
  values (v_nome)
  returning tenants.id into v_id;

  insert into public.membros (tenant_id, user_id, papel)
  values (v_id, v_uid, 'dono');

  return query
    select t.id, t.nome from public.tenants t where t.id = v_id;
end;
$FUNC$;

revoke all on function public.create_tenant_with_owner(text) from public, anon;
grant execute on function public.create_tenant_with_owner(text) to authenticated;
