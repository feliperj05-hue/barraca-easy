# Issues iniciais sugeridas

## Milestone 1 — React local MVP

### #1 Criar estrutura React + Vite
Criar app base com rotas/telas iniciais: Caixa, Produção, Fechamento e Configurações.

### #2 Migrar visual do protótipo HTML
Migrar layout touch-friendly do HTML para componentes React.

### #3 Implementar tela Caixa
Carrinho, produtos, forma de pagamento e botão Confirmar pedido.

### #4 Implementar popup Aguardando Pagamento
Popup deve abrir após confirmar pedido. Caixa informa senha física somente depois de pagamento confirmado.

### #5 Implementar validação de senha duplicada
Bloquear senha repetida no mesmo dia, exceto se pedido anterior estiver cancelado.

### #6 Implementar tela Produção
Listar pedidos aguardando/chamados. Permitir chamar senha, entregar e cancelar.

### #7 Implementar tela Fechamento
Calcular total vendido, pagamento, produtos, entregues, pendentes, cancelados e ticket médio.

### #8 Implementar tela Configurações
Mostrar 3 modos pré-configurados e salvar modo atual em localStorage.

### #9 Criar services
Criar `orderService`, `productService`, `closingService` e `settingsService`.

### #10 Preparar PWA básico
Adicionar manifest e estrutura inicial para instalação futura.

## Milestone 2 — Firebase

### #11 Configurar Firebase
Adicionar Firebase client, ambiente e estrutura inicial.

### #12 Implementar Auth
Login com e-mail e senha.

### #13 Implementar Firestore para produtos e pedidos
Persistir dados por `businessId`.

### #14 Implementar sincronização em tempo real
Produção escuta pedidos do dia com status aguardando/chamado.

### #15 Regras de segurança
Criar regras para isolamento por barraca.

## Milestone 3 — Piloto

### #16 Cadastro de produtos via Admin
Permitir editar produtos e preços.

### #17 Deploy em Firebase Hosting
Publicar primeira URL online.

### #18 Teste em dois tablets
Validar Caixa e Produção simultaneamente.

### #19 Ajustes do piloto Barraca da Cida e Cão
Refinar fluxo real após teste operacional.
