# Barraca Easy

Sistema simples para barracas pequenas, feiras e negócios de rua que usam fluxo de caixa, senha física e produção interna.

## Objetivo do produto

O Barraca Easy organiza o fluxo operacional da barraca:

1. O caixa monta o pedido.
2. O cliente paga.
3. O caixa entrega uma senha física em papel.
4. O caixa informa no sistema qual senha foi liberada.
5. O pedido aparece na tela da produção.
6. A produção chama a senha e marca o pedido como entregue.
7. O fechamento do dia mostra vendas por item, forma de pagamento e status dos pedidos.

## Posicionamento

Barraca Easy não é um PDV fiscal completo.

É um sistema simples de pedidos, senhas, produção e fechamento para barracas que precisam reduzir confusão operacional sem mudar radicalmente o jeito de trabalhar.

## MVP atual

O MVP atual é um protótipo HTML único, com persistência em `localStorage`.

Arquivo atual de referência:

- `barraca_easy_com_configuracoes.html`

## Modos de operação previstos

1. **Caixa + Impressora**
   - Caixa registra pedido.
   - Pagamento é confirmado.
   - Sistema gera/imprime senha ou registra senha física.
   - Produção pode ser opcional.
   - Preparado para fase futura.

2. **Sincronizado com Produção**
   - Modo padrão do MVP.
   - Caixa em um tablet.
   - Produção em outro tablet.
   - Senha física informada pelo caixa.
   - Pedido aparece na produção após pagamento confirmado.

3. **100% Autônomo**
   - Cliente escolhe itens sozinho.
   - Cliente paga.
   - Sistema libera senha.
   - Pedido vai para produção.
   - Preparado para fase futura, especialmente com Pix integrado.

## Stack recomendada para evolução

Primeira fase de desenvolvimento real:

- React
- Vite
- CSS simples
- localStorage

Segunda fase:

- Firebase Hosting
- Firebase Auth
- Firestore
- PWA

## Comandos iniciais

```bash
mkdir barraca-easy
cd barraca-easy
git init
npm create vite@latest . -- --template react
npm install
npm run dev
```

## Ordem recomendada

1. Migrar protótipo HTML para React + Vite.
2. Manter dados em `localStorage`.
3. Implementar telas Caixa, Produção, Fechamento e Configurações.
4. Garantir fluxo completo do modo Sincronizado com Produção.
5. Só depois conectar Firebase.
