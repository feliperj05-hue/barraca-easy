# Barraca Easy — Arquitetura Recomendada

## Fase 1 — Protótipo estruturado

Objetivo: migrar o HTML único para um app React + Vite, mantendo persistência local.

### Stack

- React
- Vite
- CSS simples
- localStorage

### Estrutura sugerida

```text
barraca-easy/
├── README.md
├── package.json
├── vite.config.js
├── index.html
├── .gitignore
├── public/
│   └── manifest.json
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── routes/
    │   ├── Cashier.jsx
    │   ├── Production.jsx
    │   ├── Closing.jsx
    │   └── Settings.jsx
    ├── components/
    │   ├── Layout.jsx
    │   ├── ProductGrid.jsx
    │   ├── CartPanel.jsx
    │   ├── PaymentModal.jsx
    │   ├── OrderCard.jsx
    │   └── OperationModeCard.jsx
    ├── services/
    │   ├── orderService.js
    │   ├── productService.js
    │   ├── closingService.js
    │   └── settingsService.js
    ├── utils/
    │   ├── money.js
    │   ├── tickets.js
    │   └── dates.js
    └── styles/
        └── app.css
```

## Fase 2 — Firebase

Objetivo: sincronizar dois tablets reais.

### Stack

- Firebase Hosting
- Firebase Auth
- Firestore
- PWA

### Estrutura Firestore futura

```text
businesses/{businessId}
businesses/{businessId}/products/{productId}
businesses/{businessId}/days/{YYYY-MM-DD}/orders/{orderId}
businesses/{businessId}/dailyClosings/{YYYY-MM-DD}
users/{userId}
```

## Documento Business

```json
{
  "name": "Barraca da Cida e Cão",
  "status": "active",
  "plan": "monthly_75",
  "operationMode": "cashier_production_sync",
  "createdAt": "2026-07-06T10:00:00"
}
```

## Documento Order

```json
{
  "ticket": "027",
  "items": [
    {
      "productId": "coxinha",
      "name": "Coxinha",
      "qty": 2,
      "price": 8,
      "subtotal": 16
    }
  ],
  "paymentMethod": "Pix",
  "total": 16,
  "status": "aguardando",
  "createdAt": "2026-07-06T14:30:00",
  "paidAt": "2026-07-06T14:30:20",
  "calledAt": null,
  "deliveredAt": null,
  "cancelledAt": null
}
```

## Configurações

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

## Sincronização

No Firestore, a tela Produção deve escutar somente pedidos do dia atual com status:

- `aguardando`;
- `chamado`.

Não escutar histórico inteiro em tempo real para evitar custo desnecessário.

## Segurança futura

Cada usuário deve acessar apenas os `businessId` aos quais está vinculado.
