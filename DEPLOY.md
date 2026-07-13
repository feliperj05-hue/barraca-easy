# Deploy — Barraca Easy

Publicacao do build de producao (Vite) no **Firebase Hosting**. Hosting estatico
apenas: sem backend, sem Auth, sem Firestore. O app roda 100% no cliente com
`localStorage`.

## Visao geral

- Build: `npm run build` gera a pasta `dist/`.
- Hosting: `firebase.json` aponta o Hosting para `dist/` com rewrite SPA
  (`** -> /index.html`).
- Projeto: definido em `.firebaserc` (alias `default`).
- CI/CD: `.github/workflows/deploy.yml` roda lint + build em todo push/PR e
  publica no Firebase quando as credenciais estao configuradas.

## Pre-requisitos

- Node 20+ e npm.
- Conta Firebase com um projeto criado (plano Spark/gratuito basta para Hosting).
- Firebase CLI para deploy manual: `npm i -g firebase-tools`.

## 1. Criar/definir o projeto Firebase

1. Acesse https://console.firebase.google.com e crie um projeto (ou use um
   existente). Anote o **Project ID** (ex: `barraca-easy-1a2b3`).
2. Ative o **Hosting** no console (Build > Hosting > Comecar).
3. Ajuste o Project ID no repositorio:
   - Edite `.firebaserc` e troque `"barraca-easy"` pelo Project ID real, **ou**
   - Crie o projeto no Firebase exatamente com o id `barraca-easy` (se ainda
     estiver disponivel).

> `.firebaserc` traz `barraca-easy` como **placeholder**. O deploy so funciona
> quando esse id corresponder a um projeto Firebase real ao qual voce tem acesso.

## 2. Deploy manual (primeira publicacao / validacao)

```bash
npm ci
npm run build
firebase login                       # abre o navegador (uma vez por maquina)
firebase deploy --only hosting       # usa o projeto de .firebaserc
```

Ao final, o CLI mostra a **Hosting URL** (ex:
`https://barraca-easy.web.app`). Abra e valide a navegacao das 4 telas
(Caixa, Producao, Fechamento, Configuracoes) e a persistencia em `localStorage`.

Para publicar em um canal de preview temporario (sem afetar o live):

```bash
firebase hosting:channel:deploy preview-teste --expires 7d
```

## 3. Deploy automatico (GitHub Actions)

O workflow `.github/workflows/deploy.yml`:

- **Todo push e PR:** `npm ci` + `npm run lint` + `npm run build` (validacao).
- **Push na `main`:** publica no canal **live** (producao).
- **Pull request:** publica em um canal de **preview** temporario (7 dias).

Os passos de deploy so executam se o secret `FIREBASE_SERVICE_ACCOUNT` existir;
sem ele, o pipeline apenas valida lint/build e pula a publicacao (sem falhar).

### O que o Felipe precisa configurar no GitHub (obrigatorio para o deploy real)

No repositorio `feliperj05-hue/barraca-easy`, em
**Settings > Secrets and variables > Actions**:

| Tipo | Nome | Valor |
|---|---|---|
| **Secret** | `FIREBASE_SERVICE_ACCOUNT` | JSON completo da conta de servico do Firebase (ver abaixo) |
| **Variable** | `FIREBASE_PROJECT_ID` | O Project ID real do Firebase (o mesmo do `.firebaserc`) |

#### Como gerar o `FIREBASE_SERVICE_ACCOUNT`

Opcao A (recomendada, via CLI):

```bash
firebase init hosting:github
```

Esse comando cria a conta de servico, adiciona o secret no repositorio
automaticamente e gera o workflow. Se preferir manter o workflow deste repo,
gere apenas o secret e ajuste o nome para `FIREBASE_SERVICE_ACCOUNT`.

Opcao B (manual, via Google Cloud Console):

1. Console do Firebase > Configuracoes do projeto > **Contas de servico**.
2. Gere uma nova chave privada (JSON) para a conta
   `firebase-adminsdk...` (ou crie uma conta de servico com o papel
   **Firebase Hosting Admin**).
3. Copie **todo o conteudo do JSON** e cole no secret
   `FIREBASE_SERVICE_ACCOUNT`.

> Nunca commite o JSON da conta de servico nem tokens no repositorio.

## Criterios de aceite (issue #14)

- [x] `npm run build` gera `dist/` valido e servivel.
- [x] Config de hosting versionada (`firebase.json`, `.firebaserc`) sem
      credenciais commitadas.
- [x] `DEPLOY.md` com passo a passo reproduzivel.
- [ ] Deploy de teste com URL acessivel — **pendente**: depende do Felipe criar
      o projeto Firebase e configurar `FIREBASE_SERVICE_ACCOUNT` +
      `FIREBASE_PROJECT_ID` (ou rodar `firebase deploy` manual autenticado).
- [x] Branch estavel validada (lint + build) antes do deploy de producao.

## GitHub Pages + credenciais Supabase (Fase 1 SaaS)

O deploy ativo da Fase 1 e o **GitHub Pages** (`.github/workflows/pages.yml`),
URL `https://feliperj05-hue.github.io/barraca-easy/`. Como o hosting e estatico,
as credenciais publicas do Supabase sao **assadas no bundle** durante o
`vite build`, a partir de **Repository Variables** (nao Secrets — a publishable
key e publica por design e protegida por Row-Level Security).

Em **Settings > Secrets and variables > Actions > aba Variables** do repo,
crie no nivel de repositorio (case-sensitive):

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |

O job de build expoe essas variaveis via `env:` (`${{ vars.* }}`) e um step
`Check Supabase env vars` **falha o build** caso alguma esteja vazia, evitando
publicar um bundle com credenciais `undefined`. Nunca coloque aqui a
`service_role` key (secreta, server-side).

---

# Fase 1 SaaS — Firebase Hosting com STAGING e PRODUCAO (2 projetos Supabase)

> Este e o fluxo aprovado para o piloto: **staging primeiro -> testar o fluxo
> completo -> piloto com 1 barraca -> depois a 2a**. Host: **Firebase Hosting**
> (1 projeto Firebase, 2 canais). Backend: **2 projetos Supabase** separados
> (um de teste/staging, um de producao). Workflow: `.github/workflows/deploy.yml`.

## Como o pipeline decide o ambiente

| Gatilho | Build usa chaves | Publica em |
|---|---|---|
| Push na `main` | STAGING | canal `staging` (expira 30d, renova a cada push) |
| Pull request | STAGING | canal de preview temporario (7d) |
| Run workflow > environment = **production** | PRODUCAO | canal `live` (producao) |

Producao **nunca** sai sozinha num push: so via disparo manual
(Actions > CI + Deploy > Run workflow > environment = production). Trava
proposital pra so ir pra producao depois do staging validado.

## O que configurar no GitHub (Settings > Secrets and variables > Actions)

**Variables** (aba Variables — sao publicas por design, protegidas por RLS):

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
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo da conta de servico do Firebase (ver secao anterior) |

Sem `FIREBASE_SERVICE_ACCOUNT` o pipeline so valida lint/build (nao publica, nao falha).
Se faltar VARIABLE do Supabase do ambiente alvo, o build **falha de proposito**
(step "Checar credenciais Supabase") pra nunca subir bundle com credencial vazia.

## Aplicar as migrations (nos DOIS projetos Supabase)

O agente **nao** aplica DDL (so tem a publishable key). Voce aplica manualmente,
no **SQL Editor** de CADA projeto (staging e producao), na ordem abaixo. Todos os
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
(c) aplicar as 5 migrations no SQL Editor dos 2 projetos. Todos esses passos
estao detalhados nas secoes acima — mas o **item que me destrava pra tocar o
resto** e me passar as 4 linhas de credenciais Supabase.
