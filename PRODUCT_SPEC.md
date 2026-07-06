# Barraca Easy — Especificação Inicial do Produto

## Problema

Barracas pequenas costumam operar com:

- caixa externo;
- pagamento manual;
- senha física em papel;
- produção interna;
- atendentes chamando senhas verbalmente;
- fechamento do dia feito manualmente.

Isso gera risco de:

- pedido perdido;
- confusão com senha;
- atraso na produção;
- dificuldade para saber o que vendeu;
- fechamento impreciso por forma de pagamento;
- baixa visibilidade da fila.

## Solução

O Barraca Easy digitaliza o fluxo sem exigir mudança radical da operação.

## Fluxo principal do MVP

### Caixa

1. Operador adiciona produtos ao carrinho.
2. Operador seleciona forma de pagamento:
   - Pix;
   - Cartão;
   - Dinheiro.
3. Operador clica em `Confirmar pedido`.
4. Sistema abre popup `Aguardando pagamento`.
5. Cliente paga.
6. Operador entrega a senha física ao cliente.
7. Operador informa no popup o número da senha liberada.
8. Sistema valida se a senha já foi usada no dia.
9. Se estiver livre, pedido é criado e enviado à produção.
10. Tela mostra confirmação da venda.

### Produção

1. Produção vê pedidos em aberto.
2. Cada pedido mostra:
   - senha;
   - itens;
   - total;
   - forma de pagamento;
   - status.
3. Produção pode clicar em:
   - `Chamar senha`;
   - `Entregue / OK`;
   - `Cancelar`.

### Fechamento

1. Total vendido.
2. Vendas confirmadas.
3. Pedidos entregues.
4. Pedidos pendentes.
5. Ticket médio.
6. Total por forma de pagamento.
7. Total por produto.

## Regras de negócio

- O sistema não gera senha no modo padrão do MVP.
- A senha é física e prefixada.
- O caixa informa qual senha foi entregue ao cliente.
- Não permitir duas vendas ativas com a mesma senha no mesmo dia.
- Pedido só entra na produção depois do pagamento confirmado.
- Pedidos cancelados não entram no faturamento.
- Fechamento considera vendas confirmadas e não canceladas.
- O modo padrão é `cashier_production_sync`.

## Status de pedido

- `aguardando`: pedido criado e aguardando produção/chamada.
- `chamado`: senha já foi chamada.
- `entregue`: pedido entregue ao cliente.
- `cancelado`: pedido cancelado.

## Formas de pagamento

- Pix;
- Cartão;
- Dinheiro.

## Produto mínimo

Produtos podem ser fixos inicialmente, depois editáveis em tela Admin.

Produtos de exemplo:

- Coxinha;
- Pastel;
- Empada;
- Bolo de pote;
- Brigadeiro;
- Pudim;
- Fatia de bolo;
- Bolo caseiro;
- Refrigerante;
- Suco;
- Combos.
