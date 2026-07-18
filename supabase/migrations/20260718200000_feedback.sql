-- Fale com o desenvolvedor (issue #85)
--
-- Guarda o recado que o operador manda de dentro do app: problema, sugestao de
-- melhoria ou elogio.
--
-- POR QUE ESTA TABELA E NAO UM E-MAIL
--
-- O app ja fala com o Supabase pra pedido, produto e fechamento. Reaproveitar
-- esse caminho significa zero credencial nova, zero dependencia de app de
-- e-mail instalado no tablet e zero passo extra pro operador: ele toca em
-- Enviar e acabou.
--
-- O QUE ELA NAO E
--
-- Nao e fonte da verdade. A fonte da verdade e o aparelho: o app grava o recado
-- em localStorage ANTES de tentar a rede. Se esta tabela nao existir ainda, se
-- a internet cair ou se o app estiver em modo local sem conta, nada se perde —
-- o recado fica no aparelho, entra no relatorio do piloto e tenta subir depois.
-- Por isso aqui nao ha `not null` em quase nada: recado incompleto e melhor que
-- recado perdido.
--
-- COMO APLICAR: painel do Supabase > SQL Editor > cole e Run. Idempotente.
-- Rodar nos DOIS projetos (staging e producao). Ver supabase/README.md.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),

  -- id gerado no aparelho. Serve pra nao duplicar quando o app reenvia um
  -- recado que ficou preso offline.
  id_local text unique,

  tipo text not null check (tipo in ('problema', 'melhoria', 'elogio')),
  texto text,

  -- Contexto capturado sozinho, sem ninguem digitar. E o que transforma
  -- "travou" em algo investigavel.
  tela text,
  online boolean,
  pendentes integer,

  tenant_id uuid references public.tenants (id) on delete set null,
  tenant_nome text,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  user_email text,
  papel text,
  modo text,
  app_url text,
  navegador text,
  instalado boolean,

  -- Hora do aparelho (pode estar torta) e hora do servidor (essa e confiavel).
  -- Guardo as duas: a diferenca entre elas ja explicou mais de um mistério.
  criado_em timestamptz,
  recebido_em timestamptz not null default now()
);

create index if not exists feedback_recebido_em_idx on public.feedback (recebido_em desc);
create index if not exists feedback_tipo_idx on public.feedback (tipo);

alter table public.feedback enable row level security;

-- INSERT: qualquer pessoa logada pode mandar recado, de qualquer barraca.
-- Feedback nao e dado de venda; travar por tenant so criaria caso em que a
-- pessoa nao consegue reclamar justamente porque a associacao dela quebrou —
-- que e exatamente quando ela mais tem o que reclamar.
--
-- Anonimo NAO entra: o endpoint e publico e sem sessao isso vira caixa de spam.
-- Em modo local (sem conta) o recado fica no aparelho e sai no relatorio.
drop policy if exists "feedback: logado pode mandar" on public.feedback;
create policy "feedback: logado pode mandar"
  on public.feedback for insert
  to authenticated
  with check (auth.uid() is not null);

-- SELECT: so o proprio autor ve o que escreveu. Ninguem le recado de ninguem.
-- Quem le tudo sou eu, pelo painel do Supabase (service_role), que ignora RLS.
drop policy if exists "feedback: cada um ve o seu" on public.feedback;
create policy "feedback: cada um ve o seu"
  on public.feedback for select
  to authenticated
  using (user_id = auth.uid());

-- Sem policy de update/delete de proposito: recado nao se edita nem se apaga
-- pelo app. Historico de reclamacao que muda depois nao serve pra nada.
