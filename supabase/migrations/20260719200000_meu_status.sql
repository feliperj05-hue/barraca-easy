-- Barraca Easy - Status do usuario logado, sem precisar dizer qual barraca
-- (epic #107, item 4)
--
-- POR QUE ESTA FUNCAO EXISTE
--
-- `minha_assinatura(p_tenant_id)` responde "como esta a barraca X". Serve
-- perfeitamente dentro do app, onde a barraca ja e conhecida desde o login.
--
-- Nao serve para o site comercial. Quando alguem cai na pagina de planos, o
-- site precisa saber ANTES de desenhar a tela:
--
--   - tem conta?          -> mostra "Entrar" ou "Criar conta"
--   - ja tem barraca?     -> mandar para o app, nao para o cadastro de novo
--   - ja tem plano ativo? -> nao oferecer contratacao a quem ja paga
--   - esta em teste?      -> "faltam N dias", com o N vindo do banco
--
-- E nesse momento o site nao tem tenant nenhum para passar como argumento.
-- Sem esta funcao, a alternativa seria o front consultar `membros`, depois
-- `tenants`, depois `planos`, e concluir sozinho se pode ou nao vender — ou
-- seja, a regra de negocio migrando para o navegador, que e exatamente o que
-- nao pode acontecer num fluxo de cobranca. Uma ida ao banco, uma resposta,
-- zero decisao no cliente.
--
-- SEGURANCA
--
-- SECURITY DEFINER passa por cima da RLS, entao a funcao nao aceita nenhum
-- parametro: ela responde SEMPRE sobre `auth.uid()` e mais ninguem. Nao ha
-- como pedir o status de outra pessoa porque nao ha onde escrever o alvo.
--
-- Visitante sem sessao (`auth.uid()` nulo) recebe uma linha honesta com
-- autenticado = false, em vez de erro. A pagina publica de planos precisa
-- renderizar para quem nunca entrou — esse e o caso mais comum dela.
--
-- MULTIPLA BARRACA: hoje um usuario pode, em tese, ser membro de mais de um
-- tenant. O app ja escolhe um so; aqui a escolha e explicita e estavel (a
-- barraca mais antiga em que a pessoa e dono; se nao for dono de nenhuma, a
-- mais antiga em que e membro). `barracas` devolve o total para o dia em que
-- existir um seletor de barraca, sem precisar de outra migration.
--
-- Idempotente.

create or replace function public.meu_status()
returns table (
  autenticado        boolean,
  user_id            uuid,
  email              text,
  tem_barraca        boolean,
  barracas           integer,
  tenant_id          uuid,
  tenant_nome        text,
  papel              text,
  plano              text,
  plano_nome         text,
  valor_mensal       numeric,
  max_usuarios       integer,
  usuarios_atuais    integer,
  status_assinatura  text,
  em_teste           boolean,
  teste_expira_em    date,
  dias_restantes     integer,
  ativo              boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tid uuid;
begin
  if v_uid is null then
    return query select
      false, null::uuid, null::text, false, 0, null::uuid, null::text,
      null::text, null::text, null::text, null::numeric, null::integer,
      null::integer, null::text, false, null::date, null::integer, false;
    return;
  end if;

  -- Barraca de referencia: dono antes de operador. Quem e dono de uma e
  -- operador de outra deve cair na propria — e a que ele administra e paga.
  select m.tenant_id into v_tid
  from public.membros m
  where m.user_id = v_uid
  order by (m.papel = 'dono') desc, m.created_at asc
  limit 1;

  return query
  select
    true,
    v_uid,
    (select u.email::text from auth.users u where u.id = v_uid),
    v_tid is not null,
    (select count(*)::int from public.membros m where m.user_id = v_uid),
    t.id,
    t.nome,
    (select m.papel from public.membros m
      where m.user_id = v_uid and m.tenant_id = t.id),
    t.plano,
    p.nome,
    t.valor_mensal,
    p.max_usuarios,
    public.usuarios_no_tenant(t.id),
    t.status_assinatura,
    t.status_assinatura = 'teste',
    t.teste_expira_em,
    case when t.status_assinatura = 'teste' and t.teste_expira_em is not null
         then (t.teste_expira_em - current_date)::int end,
    public.tenant_ativo(t.id)
  from public.tenants t
  left join public.planos p on p.codigo = t.plano
  where t.id = v_tid;

  -- Usuario autenticado que ainda nao criou barraca: o join acima nao
  -- devolve linha nenhuma e o site precisa de uma resposta, nao de vazio.
  if not found then
    return query select
      true, v_uid,
      (select u.email::text from auth.users u where u.id = v_uid),
      false, 0, null::uuid, null::text, null::text, null::text, null::text,
      null::numeric, null::integer, null::integer, null::text, false,
      null::date, null::integer, false;
  end if;
end;
$$;

comment on function public.meu_status() is
  'Status do usuario logado (conta, barraca, plano, teste) sem receber tenant. '
  'Usada pelo site publico, onde a barraca ainda nao e conhecida. Responde '
  'somente sobre auth.uid(); visitante sem sessao recebe autenticado=false.';

-- `anon` tambem executa: a pagina publica de planos chama isto antes de
-- qualquer login e recebe a linha de visitante.
grant execute on function public.meu_status() to anon, authenticated;
