# Prompt para Agente Desenvolvedor IA — Barraca Easy

Você é o agente desenvolvedor do projeto Barraca Easy.

## Contexto

Barraca Easy é um sistema simples para barracas pequenas, feiras e negócios de rua. O fluxo principal é baseado em caixa externo, pagamento manual, senha física em papel e produção interna.

O cliente faz o pedido no caixa, paga, recebe uma senha física, e os atendentes internos acompanham os pedidos em uma tela de produção, chamando senhas e marcando pedidos como entregues.

## Objetivo atual

Criar um MVP web/PWA usando React + Vite.

Nesta primeira fase:

- não implementar Firebase;
- não implementar login;
- não implementar Pix integrado;
- não implementar cartão integrado;
- ~~não implementar impressora~~ — **liberado em 18/07/2026**: a impressora
  térmica ESC/POS via WebUSB está implementada (issue #63). Ver a seção
  "Impressora térmica" abaixo;
- manter persistência com `localStorage`.

## Referência visual e funcional

Usar como referência o protótipo HTML:

- `barraca_easy_com_configuracoes.html`

## Fluxo obrigatório do modo padrão

Modo padrão:

```text
cashier_production_sync
```

### Caixa

1. Operador escolhe produtos.
2. Carrinho mostra itens e total.
3. Operador escolhe forma de pagamento:
   - Pix;
   - Cartão;
   - Dinheiro.
4. Operador clica em `Confirmar pedido`.
5. Sistema abre popup `Aguardando pagamento`.
6. Após o cliente pagar, operador entrega uma senha física em papel.
7. Operador informa no popup o número da senha entregue.
8. Sistema impede senha duplicada no mesmo dia.
9. Operador confirma `Pagamento confirmado`.
10. Pedido entra na fila da Produção.

### Produção

1. Mostrar pedidos em aberto.
2. Ordenar por senha ou horário de criação.
3. Mostrar senha, itens, total e forma de pagamento.
4. Botões:
   - `Chamar senha`;
   - `Entregue / OK`;
   - `Cancelar`.

### Fechamento

1. Total vendido.
2. Total por forma de pagamento.
3. Quantidade por produto.
4. Vendas confirmadas.
5. Pedidos entregues.
6. Pedidos pendentes.
7. Pedidos cancelados.
8. Ticket médio.

## Configurações obrigatórias

Criar uma tela `Configurações` com 3 modos pré-configurados:

### 1. Caixa + Impressora

```json
{
  "operationMode": "cashier_printer",
  "deviceMode": "cashier",
  "ticketMode": "manual_or_system_generated",
  "usesProductionScreen": false,
  "customerSelfService": false,
  "paymentTiming": "before_ticket"
}
```

Status: preparado para próxima fase.

### 2. Sincronizado com Produção

```json
{
  "operationMode": "cashier_production_sync",
  "deviceMode": "cashier",
  "ticketMode": "manual_physical_ticket",
  "usesProductionScreen": true,
  "customerSelfService": false,
  "paymentTiming": "before_ticket"
}
```

Status: completo no MVP.

### 3. 100% Autônomo

```json
{
  "operationMode": "self_service_kiosk",
  "deviceMode": "kiosk",
  "ticketMode": "system_generated",
  "usesProductionScreen": true,
  "customerSelfService": true,
  "paymentTiming": "before_production"
}
```

Status: preparado para próxima fase.

## Regras de negócio

- No modo padrão, o sistema não gera senha.
- A senha é física e prefixada.
- O caixa informa qual senha foi entregue ao cliente.
- Não permitir duas vendas ativas com a mesma senha no mesmo dia.
- Pedido só entra na produção depois do pagamento confirmado e senha informada.
- Pedidos cancelados não entram no faturamento.
- O fechamento considera vendas confirmadas e não canceladas.
- A UI deve ser grande, simples e touch-friendly.
- Não complicar com recursos fora do escopo.

## Critérios de aceite

- `npm run dev` abre o app localmente.
- Caixa lança pedido.
- Popup `Aguardando pagamento` aparece.
- Caixa informa senha física.
- Sistema bloqueia senha duplicada.
- Pedido aparece na Produção.
- Produção chama e entrega pedido.
- Fechamento soma corretamente.
- Configurações mostram os 3 modos.
- Modo padrão salvo em `localStorage`.
- Dados persistem após recarregar a página.


## Impressora térmica (liberado em 18/07/2026 — issue #63)

A restrição antiga de "não implementar impressora" **não vale mais**. Felipe
decidiu em 18/07/2026 adiar o TWA/Play Store e priorizar a impressão do cupom.

Arquitetura implementada:

- `src/services/escpos.js` — camada pura: documento de blocos → bytes ESC/POS
  ou texto de pré-visualização. Sem navegador, sem React.
- `src/services/receiptLayout.js` — monta o cupom a partir do pedido real do
  app, com a senha em corpo ampliado.
- `src/services/printerService.js` — WebUSB (detecção de suporte, pareamento,
  envio) + configuração da impressora em `localStorage`.
- `src/components/PrinterSettingsCard.jsx` — tela de configuração com prévia do
  cupom e dump dos bytes.

Decisões técnicas que NÃO devem ser revertidas sem conversa:

- **Não usar `window.print()`**: sempre abre diálogo do sistema, inviável com
  fila no balcão.
- **Não usar Web Bluetooth**: o Chrome só fala BLE e as térmicas baratas usam
  Bluetooth Classic/SPP. WebUSB por cabo OTG é o caminho.
- **iPhone/Safari não tem WebUSB**: o app detecta e explica; a impressão
  automática é recurso do tablet Android com Chrome.
- **Falha de impressão nunca derruba a venda**: `printOrder` devolve
  `{ printed, reason }` em vez de estourar exceção.

Perfil de hardware assumido: térmica genérica compatível com ESC/POS (padrão
Epson TM-T20 e clones), classe USB 7, papel 58mm (32 colunas) por padrão,
80mm (48 colunas) configurável. Codepage CP850 com fallback ASCII.

Ainda **não validado com hardware físico** (impressora não comprada até
18/07/2026): corte de papel, codepage real do modelo e endpoint USB específico.

## Identidade visual (issue #71 — 18/07/2026)

A UI foi repaginada para um visual maduro, quente e artesanal. As regras
abaixo nao sao gosto pessoal: sao o que impede a tela de virar arco-iris
de novo.

### Tokens por funcao, nao por cor

Toda cor vive em `src/styles/app.css`, no bloco `:root`, com nome de
**funcao** (`--cor-acao`, `--cor-status-ok`, `--cor-nav`). Nao existe
`--laranja` nem `--verde`. Quem quiser "um botao verde" nao acha token
para isso, e e essa a intencao.

### As tres regras que nao se quebram

1. **Laranja forte (`--cor-acao`) so em acao primaria.** Confirmar pedido,
   Chamar senha, Proximo cliente, Fechar caixa. Se tudo for laranja, nada
   e laranja e o operador perde a referencia de onde tocar.
2. **Verde so em status positivo.** Online, sincronizado, entregue,
   sucesso. Botao de confirmacao positiva usa `.btn-ok`. Verde nunca e
   decoracao, nunca e cor de preco, nunca e "botao secundario".
3. **Carvao (`--cor-nav`) para navegacao, texto forte e a senha.** A senha
   aparece em carvao no Caixa e na Producao — mesmo dado, mesma cor.

### Contraste e requisito, nao enfeite

O tablet fica no balcao pegando sol. `npm run contraste` valida todo par
cor/fundo contra WCAG AA (4.5:1 normal, 3:1 texto grande) e sai com erro
se algum reprovar. **Rode antes de trocar qualquer cor.**

Armadilhas ja medidas e resolvidas:

- `#f45f0d` com branco da **3.24:1** — vale so para texto grande em
  negrito, ou seja, o CTA. Nunca para texto miudo.
- `#8a8a81` (cinza quente) sobre a areia da **2.69:1** — reprovado. Nao e
  cor de texto; serve para borda, icone decorativo e desabilitado. Texto
  secundario usa `--cor-texto-suave` (#5c5b53, 5.3:1).
- `#ca6129` como texto sobre a areia da **2.90:1** — reprovado. Laranja
  como texto usa `--cor-acao-texto` (#9a4413, 5.1:1).
- `#e9a475` tem luminancia media: preenchimento e borda, nunca texto.

### Performance

O alvo e tablet Android de entrada. Foram removidos `backdrop-filter:
blur()`, os gradientes de tela inteira e as sombras longas; a sombra
padrao e curta (`--sombra`). O `transform` no hover dos botoes tambem
saiu: em touch o estado ficava grudado depois do toque e a grade inteira
parecia tremer.

### Navegacao: abas no topo, nao barra lateral

O conceito visual que originou esta issue trazia uma barra lateral de
92px com Caixa/Producao/Fechamento/Ajustes. **Foi decidido manter as tres
abas no topo mais a engrenagem** (issue #68), por dois motivos:

- em tablet deitado, largura e o recurso escasso — a coluna lateral
  comeria espaco justamente da grade de produtos e do carrinho, que sao
  a tela de trabalho;
- Ajustes continua fora da barra principal de proposito. A barra e o que
  a equipe toca com cliente na frente; configuracao e coisa de antes de
  abrir a barraca.

O visual da barra lateral (fundo carvao, item ativo em papel solido) foi
absorvido pelo cabecalho, entao a identidade do conceito ficou sem custar
largura de tela.

### Previa para aprovacao

`npm run previa` gera `public/previa-visual.html`: as 4 telas empilhadas
usando a folha de estilo real (nao uma copia). `?tela=N` isola uma tela.
Como le o `app.css` de verdade, nao existe previa bonita divergindo do
que o operador ve no balcao.
