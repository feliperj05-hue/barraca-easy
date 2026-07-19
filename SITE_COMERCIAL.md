# Site comercial do Barraca Easy

Origem: entrega externa "site comercial v1", integrada ao repositorio na
issue #111. Este documento descreve o que REALMENTE entrou, que nem sempre e
o que o pacote original propunha.

## Onde cada coisa mora

| Endereco | O que e |
|---|---|
| `/` | aplicativo (login, onboarding, caixa) |
| `/caixa`, `/producao`, `/fechamento`, `/configuracoes`, `/clientes` | telas do app (#107) |
| `/comercial` | home comercial |
| `/comercial/precos` | catalogo publico de planos |
| `/comercial/novidades` | melhorias e o que esta por vir |
| `/site/*.html` | site publico estatico (#107), inclui privacidade e termos |

**A raiz `/` continua sendo o APLICATIVO, de proposito.** O pacote original
punha a home comercial na raiz e mandava o app para `/app`. Isso muda o
`start_url` do PWA: o tablet ja instalado no piloto passaria a abrir na
pagina de vendas depois de um update. Trocar a home e decisao de produto
pendente (#107 item 3) — quando for tomada, muda em `src/services/siteConfig.js`.

Hoje convivem DOIS sites publicos: o estatico de #107 (SEO, HTML de verdade,
zero React) e este React em `/comercial` (design acabado). Isso e provisorio.
Um dos dois vira a home oficial e o outro se aposenta — decisao do Felipe.

## Carregamento separado

Site e app sao baixados por rota. Confirmado no build:

- `MarketingSite` — 30 kB JS + 28 kB CSS
- `AppGate` — 336 kB
- `xlsx` — 493 kB

Quem abre a pagina de vendas no 4G nao baixa uma linha do app.

## Enderecos e dominio

Toda URL absoluta sai de `src/services/siteConfig.js`. Nao ha dominio escrito
no meio do JSX.

O dominio da marca sera `barracaeasy.com.br` (SEM hifen). **Ainda nao foi
registrado**, entao NAO e o valor padrao: canonical apontando para dominio
que nao resolve quebra SEO e da 404. O padrao segue `barraca-easy.web.app`.
A virada e trocar `VITE_SITE_URL`.

Nao uniformize os nomes: projeto Firebase, repositorio e host usam
`barraca-easy` COM hifen; o dominio da marca e sem. Nao e typo.

**A virada de dominio nao e indolor.** Origem nova e outro sandbox do
navegador: `localStorage`, IndexedDB, fila offline e service worker nao
migram. Isso inclui o plano escolhido no site (`services/selectedPlan.js`) —
quem escolher no dominio velho e terminar o cadastro no novo perde a
pre-selecao. Perde a pre-selecao, nao a venda: escolhe de novo dentro do app.

## Contato e cor da marca (#114)

### E-mail

O endereco oficial e `contato@barracaeasy.com.br`, definido pelo Felipe. Ele
mora em `src/services/siteConfig.js` (`CONTATO_EMAIL`) e **nao aparece na tela
por padrao**.

O motivo e simples: o dominio `barracaeasy.com.br` ainda nao foi registrado.
Ate ele existir, esse endereco nao recebe nada — quem escrever leva devolucao
do servidor. Canal de contato morto numa pagina que vende assinatura e pior do
que canal nenhum: o cliente acha que falou com a gente e fica esperando.

Com a flag desligada, o site mostra o caminho que **funciona hoje**: o botao
"Fale com o desenvolvedor", dentro do app, que ja manda junto a tela em que a
pessoa estava.

**Para ligar quando o dominio subir:**

1. `VITE_CONTATO_ATIVO=true` no ambiente — resolve o site React de `/comercial`
   sozinho, sem deploy de codigo.
2. `site/contato.html`: trocar o paragrafo pelo endereco. Esta pagina e HTML
   estatico puro (sem React, de proposito, por SEO), entao nao le variavel de
   ambiente em tempo de execucao. O comentario dentro do arquivo diz onde.

Sao dois passos, nao um. E o preco de manter as paginas publicas como HTML de
verdade — e vale a pena, porque e o que faz o buscador enxergar o conteudo.

### theme-color

`#3c3835` em `index.html` e `public/manifest.json` (os dois tem que andar
juntos).

Esse valor pinta a barra de status do sistema, que fica colada no cabecalho do
app. O cabecalho e `--cor-nav: #3c3835` (carvao) da paleta oficial da #71 —
entao a barra encosta nele sem emenda.

O valor anterior, `#e8541e`, era residuo da paleta antiga: nao era o laranja de
acao (`#f45f0d`) nem o institucional (`#ca6129`). Nao pertencia a paleta
nenhuma.

**O azul-marinho `#082b61` que veio na entrega do consultor NAO foi adotado.**
Aquilo nao e adequacao de cor, e troca de identidade visual — mexeria na marca
inteira e reabriria a #71. Se for para adotar o azul, e decisao de marca, com
issue propria.

## Planos

Preco nao fica duplicado no frontend. A migration
`supabase/migrations/20260719183000_site_comercial_publico.sql` cria a RPC:

```sql
catalogo_publico_planos()
```

Ela existe porque a tabela `planos` so da `select` para `authenticated`
(#94) — visitante anonimo nao le. A RPC e `security definer`, `stable`,
com `search_path` fixo, e devolve so os campos comerciais dos planos
`contratavel = true`.

Fluxo: escolher plano no site grava o codigo em `localStorage`, o botao leva
para `/?acao=cadastro&plano=<codigo>`, e depois do cadastro da barraca o app
abre em **Minha assinatura** com o plano destacado e o botao "Confirmar plano
escolhido". Ao contratar, a marca e apagada.

## Novidades

A mesma migration cria `product_updates` com RLS: leitura publica so de
`publicado = true`, escrita so para `is_plataforma_admin()`.

## Previa

```
npm run previa-site   ->  public/previa-site-comercial.html
```

Arquivo unico, com o JSX e o CSS de verdade. Planos e novidades sao dados de
EXEMPLO — os valores oficiais vem do banco.

## Antes de publicar em producao

1. Aplicar a migration em homologacao e validar leitura anonima.
2. Aplicar a migration em producao.
3. Decidir qual site vira a home e aposentar o outro.
4. Revisar os textos comerciais, de preco, termos e privacidade.
5. ~~Definir o e-mail de contato do rodape.~~ Feito (#114): endereco
   definido e parametrizado, publicacao presa a `VITE_CONTATO_ATIVO` ate o
   dominio existir.
6. Trocar os mockups CSS por capturas reais do app.
7. Escolher provedor de pagamento: checkout hospedado, webhook, idempotencia
   e reconciliacao.
8. Captacao de interesse no totem so com protecao contra abuso e consentimento.
