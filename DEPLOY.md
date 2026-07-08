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
