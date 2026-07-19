-- Barraca Easy - Remover membro (issue #101)
--
-- A policy `membros_delete` (so dono) existe desde o inicio, mas nenhuma tela
-- e nenhum servico chamavam DELETE em `membros`. Na pratica: funcionario saia
-- da barraca e o dono NAO conseguia tirar o acesso dele sem intervencao
-- manual no painel do Supabase. Com cliente pagante isso nao para em pe.
--
-- Segue o padrao do `add_member`: RPC SECURITY DEFINER, com a checagem de
-- permissao explicita dentro da funcao (a RLS sozinha nao basta porque
-- SECURITY DEFINER passa por cima dela).
--
-- PROTECAO DO ULTIMO DONO
--
-- A barraca nunca pode ficar sem ninguem com papel `dono` — seria uma conta
-- orfa: dados vivos, assinatura ativa e nenhum humano capaz de configurar,
-- fechar o caixa ou readicionar membro. Recuperar isso exigiria mexer no
-- banco na mao, que e exatamente o que esta issue veio matar.
--
-- Por isso a funcao recusa remover o ultimo dono, inclusive quando o dono
-- tenta remover a si proprio. Sair da barraca so depois de promover outro.
--
-- Idempotente.

create or replace function public.remove_member(
  p_tenant_id uuid,
  p_user_id   uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papel text;
  v_donos integer;
begin
  if not public.is_tenant_owner(p_tenant_id) then
    raise exception 'Apenas o dono pode remover membros.' using errcode = '42501';
  end if;

  select m.papel into v_papel
  from public.membros m
  where m.tenant_id = p_tenant_id and m.user_id = p_user_id;

  if v_papel is null then
    raise exception 'Essa pessoa nao e membro desta barraca.' using errcode = 'P0002';
  end if;

  if v_papel = 'dono' then
    select count(*) into v_donos
    from public.membros m
    where m.tenant_id = p_tenant_id and m.papel = 'dono';

    if v_donos <= 1 then
      raise exception
        'A barraca precisa de pelo menos um dono. Promova outra pessoa a dono antes de remover esta.'
        using errcode = '23514';
    end if;
  end if;

  delete from public.membros
  where tenant_id = p_tenant_id and user_id = p_user_id;

  return true;
end;
$$;

grant execute on function public.remove_member(uuid, uuid) to authenticated;
