
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
