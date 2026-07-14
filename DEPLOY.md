# Deploy — Barraca Easy

**Host de producao aprovado: Firebase Hosting** (1 projeto Firebase, 2 canais:
`staging` e `live`). **Backend: Supabase** (2 projetos separados — staging e
producao — Postgres + Auth, multi-tenant com RLS). O front e um PWA React + Vite;
sem credenciais Supabase no build, o app cai no modo local (`localStorage`) sem
quebrar.

> GitHub Pages nao e mais o host ativo. Ele fica so como **fallback manual**
> "sem Firebase" (`.github/workflows/pages.yml`, roda a mao em Actions > Run
> workflow). Nao dispara no push da main pra nao publicar em duas URLs ao mesmo
> tempo. O host oficial e o Firebase.

## Visao geral

- Build: `npm run build` gera `dist/` (base `/`, raiz do dominio Firebase).
- Hosting: `firebase.json` aponta o Hosting para `dist/` com rewrite SPA
  (`** -> /index.html`).
- Projeto Firebase: definido em `.firebaserc` (alias `default`).
- CI/CD: `.github/workflows/deploy.yml` roda lint + build em todo push/PR e
  publica no Firebase quando as credenciais estao configuradas.

## Como o pipeline decide o ambiente (`.github/workflows/deploy.yml`)

| Gatilho | Build usa chaves | Publica em |
|---|---|---|
| Push na `main` | STAGING | canal `staging` (expira 30d, renova a cada push) |
| Pull request | STAGING | canal de preview temporario (7d) |
| Run workflow > environment = **production** | PRODUCAO | canal `live` (producao) |

Producao **nunca** sai sozinha num push: so via disparo manual
(Actions > CI + Deploy > Run workflow > environment = production). Trava
proposital pra so ir pra producao depois do staging validado.

Sem `FIREBASE_SERVICE_ACCOUNT`, o pipeline so valida lint/build (nao publica, nao
falha). Se faltar VARIABLE do Supabase do ambiente alvo, o build **falha de
proposito** (step "Checar credenciais Supabase") pra nunca subir bundle com
credencial vazia.

## O que configurar no GitHub (Settings > Secrets and variables > Actions)

**Variables** (aba Variables — publicas por design, protegidas por RLS):

| Nome | Valor |
|---|---|
| `FIREBASE_PROJECT_ID` | Project ID do Firebase (ex.: `barraca-easy-1a2b3`) |
| `SUPABASE_URL_STAGING` | `https://<ref-staging>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY_STAGING` | `sb_publishable_...` (projeto staging) |
| `SUPABASE_URL_PRODUCTION` | `https://<ref-producao>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY_PRODUCTION` | `sb_publishable_...` (projeto producao) |

**Secret** (aba Secrets — sensivel):

| Nome | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo da conta de servico do Firebase (ver abaixo) |

> Nunca coloque aqui a `service_role` key do Supabase (secreta, server-side).
> Nunca commite o JSON da conta de servico do Firebase.

## Criar o projeto Firebase e gerar o `FIREBASE_SERVICE_ACCOUNT`

1. Acesse https://console.firebase.google.com e crie um projeto (plano
   Spark/gratuito basta para Hosting). Anote o **Project ID**.
2. Ative o **Hosting** (Build > Hosting > Comecar).
3. Ajuste o Project ID no repo: edite `.firebaserc` e troque `"barraca-easy"`
   (placeholder) pelo Project ID real, e lance o mesmo id na Variable
   `FIREBASE_PROJECT_ID`.
4. Gere a conta de servico para o secret `FIREBASE_SERVICE_ACCOUNT`:
   - **Via CLI (recomendado):** `firebase init hosting:github` cria a conta,
     adiciona o secret e gera um workflow. Mantenha o workflow deste repo e
     apenas garanta que o secret se chame `FIREBASE_SERVICE_ACCOUNT`.
   - **Manual:** Console Firebase > Configuracoes do projeto > Contas de servico
     > gere chave privada (JSON) da conta `firebase-adminsdk...` (papel Firebase
     Hosting Admin) e cole o JSON inteiro no secret.

## Aplicar as migrations (nos DOIS projetos Supabase)

O agente **nao** aplica DDL (so tem a publishable key). Voce aplica manualmente,
no **SQL Editor** de CADA projeto (staging e producao), nesta ordem. Todos os
scripts sao idempotentes (podem rodar de novo sem quebrar):

1. `supabase/migrations/20260712120000_init_multitenant.sql`
2. `supabase/migrations/20260712130000_auth_member_rpcs.sql`
3. `supabase/migrations/20260712140000_onboarding_tenant_rpc.sql`
4. `supabase/migrations/20260712150000_produtos_seed_flag.sql`
5. `supabase/migrations/20260712160000_create_order_rpc.sql`

Depois, em CADA projeto: Authentication > Providers > **Email** habilitado;
**Confirm email** LIGADO; **Signups** habilitados; e em URL Configuration,
**Site URL** + **Redirect URLs** apontando para a URL do Firebase daquele
ambiente (staging usa a URL do canal `staging`; producao usa a URL `live`).

## Deploy manual (opcional, primeira publicacao / validacao)

```bash
npm ci
npm run build                        # base "/", pronto pro Firebase
firebase login                       # abre o navegador (uma vez por maquina)
firebase deploy --only hosting       # usa o projeto de .firebaserc
```

Para um canal de preview temporario, sem afetar o live:

```bash
firebase hosting:channel:deploy preview-teste --expires 7d
```

## Build local por ambiente (opcional, pra testar antes)

```bash
cp .env.staging.example .env.staging        # preencha com as chaves de STAGING
npm run build:staging                        # gera dist/ apontando pro staging
cp .env.production.example .env.production   # preencha com as chaves de PRODUCAO
npm run build:production                      # gera dist/ apontando pra producao
```

---

# Roteiro de teste manual (executar no STAGING antes do piloto)

Abra a URL do canal `staging`. Instale como PWA no tablet (menu do navegador >
"Adicionar a tela inicial"; abre em tela cheia). Rode na ordem:

1. **Onboarding/login** — cadastre um usuario (dono), confirme o e-mail, crie a
   barraca. Confirme que entrou como dono.
2. **Cardapio** — veja os produtos padrao (tag "Padrao"); crie 1 produto novo;
   reprecifique um padrao. Recarregue a pagina: os dados persistem (vieram da nuvem).
3. **Caixa — montar pedido** — adicione itens (ouve o bip de item), escolha a
   forma de pagamento, clique **Confirmar pedido**. Abre o popup
   **"Aguardando pagamento"** (ouve o bip de pagamento ao confirmar).
4. **Senha fisica** — informe a senha entregue (ex.: `12`). Pedido vai pra Producao.
5. **Bloqueio de senha duplicada** — tente criar outro pedido com a **mesma senha
   `12`** no mesmo dia: o sistema **recusa** com mensagem amigavel.
6. **Producao** — veja o pedido na fila; **chame a senha**; depois marque
   **Entregue**.
7. **Cancelamento** — crie um pedido, cancele-o. Confirme que some do faturamento.
8. **Senha liberada por cancelamento** — a senha do pedido cancelado pode ser
   reutilizada no mesmo dia (crie um novo com ela).
9. **Fechamento** — feche o caixa; confira a soma por produto, por forma de
   pagamento e por status; baixe o relatorio .xlsx. Cancelados **nao** entram.
10. **Multi-dispositivo** — abra a mesma barraca em outro aparelho/aba (caixa e
    producao): um pedido criado num aparece no outro (nuvem).
11. **Offline** — desligue a internet, crie um pedido (grava local), religue: o
    pedido sobe pela fila de sync.
12. **Isolamento (RLS)** — opcional, via `supabase/tests/rls_isolation.mjs` com
    2 usuarios: um tenant nao ve dados do outro.

Passou tudo => staging validado => liberar producao (Run workflow >
environment=production) e comecar o piloto com **1 barraca**.

---

# A UNICA coisa que so o Felipe consegue fazer (destrava tudo)

Criar os **2 projetos Supabase** na sua conta (free tier, R$ 0) e me entregar as
credenciais publicas de cada um, exatamente neste formato:

```
STAGING (teste)
  SUPABASE_URL_STAGING = https://xxxxxxxx.supabase.co
  SUPABASE_PUBLISHABLE_KEY_STAGING = sb_publishable_xxxxxxxxxxxxxxxxxxxx

PRODUCAO
  SUPABASE_URL_PRODUCTION = https://yyyyyyyy.supabase.co
  SUPABASE_PUBLISHABLE_KEY_PRODUCTION = sb_publishable_yyyyyyyyyyyyyyyyyyyy
```

> So a URL e a **publishable key** (`sb_publishable_...`), que sao publicas.
> **NUNCA** me mande a `service_role` key (secreta) — ela nunca entra no repo
> nem no ambiente do agente.

Junto (ou depois), voce ainda precisa: (a) criar o projeto Firebase + gerar o
`FIREBASE_SERVICE_ACCOUNT`; (b) lancar as Variables/Secret acima no GitHub;
(c) aplicar as 5 migrations no SQL Editor dos 2 projetos. Tudo detalhado nas
secoes acima — mas o **item que me destrava pra tocar o resto** e me passar as 4
linhas de credenciais Supabase.
