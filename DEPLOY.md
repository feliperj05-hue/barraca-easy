# Deploy — Barraca Easy

**Host de producao aprovado: Firebase Hosting** (1 projeto Firebase, 2 canais:
`staging` e `live`). **Backend: Supabase** (2 projetos separados — staging e
producao — Postgres + Auth, multi-tenant com RLS). O front e um PWA React + Vite;
sem credenciais Supabase no build, o app cai no modo local (`localStorage`) sem
quebrar.

> GitHub Pages foi **aposentado** (decisao do Felipe, 15/07/2026). O host
> oficial e unico e o Firebase Hosting; o antigo workflow de fallback
> (`.github/workflows/pages.yml`) foi removido do repo.

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
| `repository_dispatch` tipo `deploy-production` (API) | PRODUCAO | canal `live` (producao) |

Producao **nunca** sai sozinha num push. Trava proposital pra so ir pra
producao depois do staging validado. Existem duas formas de publicar:

**1. Pela interface (Felipe):** Actions > CI + Deploy > Run workflow >
environment = production.

**2. Por API (agente/automacao):**

```bash
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/feliperj05-hue/barraca-easy/dispatches \
  -d '{"event_type":"deploy-production"}'
```

O caminho por API existe porque `workflow_dispatch` exige permissao
**Actions: write**, que o token fine-grained do agente nao tem (retorna 403).
Ja `repository_dispatch` exige so **Contents: write**. Sem isso o deploy de
producao dependia de alguem clicar num botao — foi exatamente assim que os PRs
da impressora (#64, #66) ficaram mergeados na `main` e fora do ar por horas
(issue #67).

`repository_dispatch` sempre roda no **branch padrao (`main`)**, entao publica o
que estiver na main no momento do disparo.

### Conferir o deploy de verdade

Nao confie no "deploy succeeded" do CI — valide o artefato publicado.

**Jeito rapido (desde #104):** todo build carimba `dist/version.json` com o commit.
O canal serve esse arquivo com `Cache-Control: no-store`, entao ele nunca vem de
cache:

```bash
curl -s https://barraca-easy.web.app/version.json
# {"sha":"944d066...","ref":"main","env":"production","built_at":"..."}
```

Se o `sha` for o commit que voce esperava, o que esta no ar e aquele codigo. O
proprio pipeline faz essa checagem no step "Verificar bundle publicado (por
conteudo)" e **falha o run** se o canal continuar servindo outro commit depois
de 6 tentativas — CI verde passou a significar deploy publicado de verdade.

**Jeito manual (marcador dentro do bundle),** util para conferir uma feature
especifica:

```bash
BUNDLE=$(curl -s https://barraca-easy.web.app/ | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -s "https://barraca-easy.web.app$BUNDLE" > /tmp/bundle.js
wc -c /tmp/bundle.js
grep -c -i "usb" /tmp/bundle.js   # esperado: > 0 desde a impressora (#63)
```

Sem `FIREBASE_SERVICE_ACCOUNT`, o pipeline so valida lint/build (nao publica, nao
falha). Se faltar VARIABLE do Supabase do ambiente alvo, o build **falha de
proposito** (step "Checar credenciais Supabase") pra nunca subir bundle com
credencial vazia.

### Concorrencia e producao atrasada (#104)

Duas armadilhas que ja morderam o projeto:

1. **Dois merges quase simultaneos.** Os PRs #102 e #103 entraram com 2 segundos
   de diferenca e dois runs publicaram no mesmo canal sem ordem garantida. Agora
   o workflow tem `concurrency` com grupo por canal alvo (`production`,
   `staging`, `pr-<n>`), entao os runs enfileiram em vez de correr. Producao usa
   `cancel-in-progress: false` — deploy de producao nunca e cortado no meio.

2. **Merge na main NAO publica producao.** Isso e de proposito (push na main vai
   pro canal `staging`), mas antes nada avisava, e mudanca ficava mergeada e fora
   do ar por horas — aconteceu com #102/#103 e antes com a impressora (#67). O
   step "Avisar se a producao esta atrasada" compara o `version.json` de producao
   com o HEAD da main e emite um warning + resumo no run quando ficam diferentes.

Para publicar producao, veja "Deploy manual" abaixo.

## O que configurar no GitHub (Settings > Secrets and variables > Actions)

**Variables** (aba Variables — publicas por design, protegidas por RLS):

> As URLs do Supabase sao a **URL base** do projeto (`https://<ref>.supabase.co`),
> sem `/rest/v1` nem barra no fim — o supabase-js monta esses caminhos sozinho.
> (O cliente ainda apara o sufixo por seguranca, mas mantenha a variavel limpa.)

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

---

# Instalar como app no tablet (PWA) — issue #49

A partir do service worker (`public/sw.js` + `src/services/pwa.js`), o Barraca
Easy vira app instalavel de verdade: icone na tela inicial, tela cheia (sem
barra do navegador) e **o app shell abre mesmo sem internet**.

> O SW so liga em build de producao. Em `npm run dev` ele fica desligado de
> proposito, senao atrapalha o hot reload do Vite.

## Como instalar no Samsung (Chrome)

1. Abrir a URL de producao no Chrome do tablet (tem que ser **HTTPS** — o
   Firebase Hosting ja serve assim; `http://` so funciona em `localhost`).
2. Menu (3 pontinhos) > **Instalar app** / **Adicionar a tela inicial**.
3. Abrir pelo icone criado: tem que subir em tela cheia, sem barra de endereco.
4. Teste do offline: com o app ja aberto uma vez, ligar o modo aviao e abrir de
   novo pelo icone — a tela do app precisa carregar.

## O que o SW cacheia (e o que nao cacheia)

| Tipo | Estrategia |
|---|---|
| Navegacao (HTML) | network-first, cai pro `index.html` cacheado quando offline |
| `/assets/*` (com hash no nome) | cache-first (arquivo com hash e imutavel) |
| Icones e `manifest.json` | stale-while-revalidate |
| Chamadas do Supabase (cross-origin) | **nunca** cacheadas, vao direto pra rede |
| Qualquer coisa nao-GET | **nunca** interceptada |

Dado de venda (pedido, produto, fechamento) **nao passa por aqui**: quem cuida
disso e o `offlineDb` + `syncQueue` (#34). Cachear resposta de API no SW so
criaria dado velho parecendo dado bom.

## Atualizacao de versao

Saiu deploy novo? O SW novo instala, a pagina manda `SKIP_WAITING` e recarrega
uma vez sozinha. O tablet da barraca fica com a aba aberta o dia todo, entao
sem isso ele ficaria preso numa versao antiga.

O `firebase.json` serve `/sw.js` com `Cache-Control: no-cache` — se o proprio
SW ficar em cache do navegador, a atualizacao trava.


---

# Qual URL usar no tablet (e por que o staging expira) — issue #54

**Resumo pratico: o tablet do piloto instala o app a partir do `live`
(`https://barraca-easy.web.app`), NUNCA da URL do canal `staging`.**

## O canal staging expira

Canal do Firebase Hosting que nao seja o `live` tem prazo de validade. O nosso
esta no maximo permitido:

| Canal | URL | Expira? |
|---|---|---|
| `live` (producao) | `https://barraca-easy.web.app` | **Nao.** Permanente. |
| `staging` | `https://barraca-easy--staging-<sufixo>.web.app` | **Sim, 30 dias** (teto do Firebase) |
| preview de PR | `https://barraca-easy--pr<N>-<branch>-<sufixo>.web.app` | Sim, 7 dias |

Confirmado no log do deploy, nao e suposicao: `expireTime` veio
`2026-08-17T12:44:24Z` para o deploy de 18/07.

**Cada deploy renova os 30 dias.** Enquanto houver push na `main` de tempos em
tempos, o staging se mantem de pe sozinho. Se o projeto ficar 30 dias parado, o
canal cai.

> `expires: 30d` no `deploy.yml` ja e o maximo. Nao adianta pedir mais — o
> default da action seria so `7d`, entao a gente ja esta no teto.

## Por que isso e serio para PWA (e nao so um link quebrado)

PWA e amarrado a **origem** (o dominio). Instalar do canal staging e depois
migrar pro `live` nao e "trocar o atalho":

- O app instalado do staging vira **outro app** aos olhos do navegador.
- `localStorage`, IndexedDB, fila offline e o service worker **nao migram**.
  Sao de outra origem.
- Quando o canal expirar, o icone na tela inicial abre em **pagina morta**, no
  meio do expediente da barraca.

Ou seja: instalar do staging significaria reinstalar tudo depois e **perder o
que estiver so no aparelho**.

## Regra pratica

- **Staging** serve para o dono testar no navegador (roteiro de teste manual
  acima) — inclusive do proprio tablet, mas **sem instalar**.
- **Live** e de onde o tablet do piloto instala. Publique em producao antes de
  entregar o tablet para a barraca.
- **Preview de PR** e so para conferir uma mudanca antes do merge. Some em 7
  dias, e normal.
