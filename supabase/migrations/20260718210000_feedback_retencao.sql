-- Retencao do feedback na nuvem (issue #87, LGPD)
--
-- Guardar recado pra sempre nao ajuda ninguem e so aumenta o tamanho do estrago
-- se um dia der problema. Prazo definido: **12 meses**. A escolha nao e chute —
-- doze meses cobrem um ciclo inteiro de sazonalidade da barraca (festa junina,
-- fim de ano, verao), que e o horizonte em que uma queixa antiga ainda diz algo
-- sobre um padrao. Passou disso, o recado ja virou correcao ou ja perdeu o
-- contexto.
--
-- IMPORTANTE: `pedidos`, `pedido_itens` e `fechamentos` NAO entram aqui. Nao ha
-- dado pessoal neles (senha de papel, forma de pagamento, total, horario), e o
-- prazo deles e assunto de guarda fiscal/contabil, nao de LGPD. Apagar venda
-- por "prazo de privacidade" seria destruir o historico do negocio por um
-- motivo que nao existe.
--
-- COMO APLICAR: painel do Supabase > SQL Editor > cole e Run. Idempotente.
-- Rodar nos DOIS projetos (staging e producao).

-- 1. A funcao que faz a limpeza.
--
-- SECURITY DEFINER porque ela e chamada por agendador, sem sessao de usuario, e
-- precisa enxergar alem da RLS. `search_path` fixo evita que alguem crie um
-- objeto com nome parecido noutro schema e sequestre a chamada.
create or replace function public.limpar_feedback_antigo()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  apagados integer;
begin
  delete from public.feedback
  where recebido_em < now() - interval '12 months';
  get diagnostics apagados = row_count;
  return apagados;
end;
$$;

comment on function public.limpar_feedback_antigo() is
  'LGPD (#87): apaga recado com mais de 12 meses. Chamada pelo agendador diario.';

-- Ninguem do app chama isso. Quem chama e o agendador (ou o dono, no painel).
revoke all on function public.limpar_feedback_antigo() from public;
revoke all on function public.limpar_feedback_antigo() from anon, authenticated;

-- 2. O agendador.
--
-- pg_cron so existe se a extensao estiver habilitada no projeto (Supabase:
-- Database > Extensions > pg_cron). Se nao estiver, este bloco nao faz nada e o
-- resto da migration passa igual — dai a limpeza fica manual, rodando
-- `select public.limpar_feedback_antigo();` de vez em quando.
--
-- 03:10 da manha, todo dia. Fora do horario de qualquer barraca.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('limpar_feedback_antigo')
      where exists (select 1 from cron.job where jobname = 'limpar_feedback_antigo');
    perform cron.schedule(
      'limpar_feedback_antigo',
      '10 3 * * *',
      'select public.limpar_feedback_antigo();'
    );
    raise notice 'pg_cron: limpeza diaria de feedback agendada para 03:10.';
  else
    raise notice 'pg_cron ausente. Habilite a extensao ou rode a limpeza a mao: select public.limpar_feedback_antigo();';
  end if;
end
$$;
