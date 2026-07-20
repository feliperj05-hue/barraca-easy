-- Barraca Easy - Cobranca paga nao pode ser cancelada (issue #121, epic #26)
--
-- POR QUE ISTO E CORRECAO, E NAO CAPRICHO.
--
-- A trilha `assinatura_eventos` e append-only de verdade: nao tem policy de
-- update nem de delete, e o grant so da SELECT. Mas o registro do DINHEIRO
-- (`cobrancas`) e mutavel, e `admin_cancelar_cobranca` carimbava
-- `status='cancelada'` em QUALQUER cobranca — inclusive numa ja PAGA. Ou seja:
-- o controle forte estava no evento menos critico.
--
-- Cancelar cobranca paga faz o historico contar que o pagamento nunca
-- aconteceu. Isso e falso, e falso CONTRA O FELIPE: se o cliente disser que
-- pagou e o sistema disser que nao, esse registro vira a defesa do cliente,
-- nao a nossa. O dinheiro entrou; isso e verdade para sempre e nenhuma tela
-- pode desdizer.
--
-- QUANDO A DEVOLUCAO EXISTIR (nao e agora — prazo e forma seguem com o
-- advogado), ela obedece a estas restricoes, ja fixadas:
--
--   1. NAO reaproveitar `admin_cancelar_cobranca`. Devolver dinheiro e o
--      oposto de dizer que a cobranca nunca valeu.
--   2. NAO alterar, cancelar nem apagar a cobranca original.
--   3. Criar REGISTRO NOVO VINCULADO a ela, com quem autorizou, quando,
--      quanto, para onde e por que — sem update e sem delete, igual a trilha
--      de assinatura.
--
-- Idempotente. Nao toca em nenhum dado existente: so muda a regra daqui pra
-- frente.


-- =====================================================================
-- 1. A RPC passa a recusar cobranca paga
-- =====================================================================
--
-- Ordem importa: le a cobranca ANTES de mexer. A versao anterior fazia
-- `update ... returning` direto e so depois olhava o que tinha pegado — nesse
-- desenho nao ha onde encaixar a recusa sem ja ter alterado a linha.
--
-- Cobranca ja cancelada devolve o estado atual sem erro (idempotente): admin
-- que clicou duas vezes nao pode levar mensagem de falha, e o resultado que
-- ele queria ja e o que esta la.

create or replace function public.admin_cancelar_cobranca(
  p_cobranca_id uuid,
  p_motivo      text default null
)
returns public.cobrancas
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.cobrancas;
begin
  if not public.is_plataforma_admin() then
    raise exception 'Acesso restrito ao administrador da plataforma.'
      using errcode = '42501';
  end if;

  select * into v from public.cobrancas where id = p_cobranca_id;

  if v.id is null then
    raise exception 'Cobranca nao encontrada.' using errcode = 'P0002';
  end if;

  -- Ja cancelada: nada a fazer, e nao e erro.
  if v.status = 'cancelada' then
    return v;
  end if;

  -- O portao. Pagamento recebido e fato, nao status editavel.
  if v.status = 'paga' then
    raise exception
      'Esta cobranca ja foi paga e nao pode ser cancelada. O pagamento aconteceu e o registro tem que continuar contando isso. Para devolver valor, use o fluxo de devolucao (registro novo, vinculado a esta cobranca) — nunca cancele a cobranca original.'
      using errcode = '42501';
  end if;

  update public.cobrancas
     set status     = 'cancelada',
         observacao = coalesce(p_motivo, observacao)
   where id = p_cobranca_id
   returning * into v;

  return v;
end;
$$;

-- =====================================================================
-- 2. Cinto e suspensorio no banco
-- =====================================================================
--
-- A checagem acima vale para quem entra pela RPC. Este trigger vale para
-- TODO MUNDO — inclusive para um update solto no SQL editor, que e
-- exatamente o caminho de onde vem o erro humano que apaga um pagamento.
--
-- So proibe a transicao paga -> cancelada. Baixa (aberta -> paga), estorno de
-- baixa (paga -> aberta, quando o Pix cai e depois volta) e edicao de
-- observacao continuam livres: o que nao pode e o registro passar a dizer que
-- o dinheiro nunca entrou.

create or replace function public.cobranca_paga_nao_cancela()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'paga' and new.status = 'cancelada' then
    raise exception
      'Cobranca paga nao pode virar cancelada (cobranca %). Devolucao se registra em lancamento novo, vinculado — a cobranca original fica como esta.',
      old.id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists cobranca_paga_nao_cancela_trg on public.cobrancas;
create trigger cobranca_paga_nao_cancela_trg
  before update on public.cobrancas
  for each row
  when (old.status is distinct from new.status)
  execute function public.cobranca_paga_nao_cancela();

-- =====================================================================
-- 3. Grants
-- =====================================================================
--
-- A funcao do trigger nao e chamavel por ninguem: quem chama e o Postgres.

revoke all on function public.admin_cancelar_cobranca(uuid, text) from public, anon;
revoke all on function public.cobranca_paga_nao_cancela()         from public, anon, authenticated;
grant execute on function public.admin_cancelar_cobranca(uuid, text) to authenticated;
