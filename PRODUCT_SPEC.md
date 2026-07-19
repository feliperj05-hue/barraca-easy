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

- A senha tem dois modos, escolhidos em Configurações → Modo de operação (#79):
  - **Manual (padrão):** o sistema não gera senha. A senha é física, prefixada
    com zeros até 3 dígitos, e o caixa informa qual entregou ao cliente.
  - **Automática:** o sistema dá o número em ordem, com 4 dígitos a partir de
    `0001`, e o caixa só lê para o cliente.
- Nos dois modos a contagem zera a cada fechamento de caixa. Não há contador
  guardado à parte: a sequência é derivada dos pedidos do dia, e fechar o caixa
  apaga os pedidos.
- No modo automático, número de pedido cancelado **não** volta a ser usado no
  mesmo expediente — o cliente que está com aquele papel na mão não pode ver
  outro pedido com a senha dele.
- Trocar de modo de senha é bloqueado enquanto houver venda no caixa aberto:
  `027` e `0027` são textos diferentes e a trava de duplicidade compara texto.
- Não permitir duas vendas ativas com a mesma senha no mesmo dia.
- Pedido só entra na produção depois do pagamento confirmado.
- Pedidos cancelados não entram no faturamento.
- Fechamento considera vendas confirmadas e não canceladas.
- O modo padrão é `cashier_production_sync`.

## Cancelamento da assinatura (#115)

O dono cancela sozinho, dentro do app, sem falar com ninguém.

**Onde fica:** Configurações → Minha assinatura, como link de texto discreto no
fim do cartão. Discreto, não escondido — rótulo literal ("Cancelar
assinatura"), a dois toques da tela inicial, sem submenu.

**Paridade de passos (regra inegociável):** cancelar não pode passar de
contratar + 1 toque.

| Fluxo | Toques | Caminho |
|---|---|---|
| Contratar | 3 | engrenagem → Minha assinatura → Escolher este |
| Cancelar | 4 | engrenagem → Minha assinatura → Cancelar assinatura → Sim, cancelar |

O toque extra do cancelamento é a confirmação, e ela existe porque cancelar é
destrutivo e contratar não. `npm run cancelamento` mede isso e falha se o teto
for estourado.

**Proibido no caminho de saída:** motivo obrigatório, tela de retenção, oferta
de desconto, "fale com o suporte", confirmação datilografada, segundo diálogo.

**Fluxo único para teste e para assinatura paga.** O que muda é o efeito, e
quem decide o efeito é o banco:

- **em teste:** encerra na hora. Nada foi cobrado, nada a devolver.
- **assinatura paga:** a barraca funciona até o fim do período já pago, e só
  depois é encerrada. Nenhuma cobrança nova; as que estiverem em aberto são
  canceladas. A tela diz a data antes de o dono confirmar.
- **suspensa:** encerra na hora (já não operava).
- **já cancelada:** não faz nada e não dá erro.

Manter a vigência até o fim do período pago é decisão de produto, não detalhe:
o cliente usa o que pagou, então **não há valor a estornar no caso comum**.
Estorno e devolução não existem no sistema e dependem de posição jurídica ainda
em aberto.

**Trilha auditável.** Toda contratação e todo cancelamento gravam em
`assinatura_eventos`: quem pediu (usuário e e-mail congelado no momento),
quando, de qual plano e por qual tela. A tabela é append-only — não tem policy
de update nem de delete, para ninguém.

**Quem pode:** só o dono. Operador não encerra o contrato da barraca.

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
