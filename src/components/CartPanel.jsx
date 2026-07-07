import { formatBRL } from '../utils/money.js'

const PAYMENTS = ['Pix', 'Cartão', 'Dinheiro']

export default function CartPanel({
  items,
  count,
  total,
  onChangeQty,
  payment,
  onSelectPayment,
  onConfirm,
}) {
  return (
    <aside className="panel">
      <div className="panel-title">
        <h2>Venda atual</h2>
        <span className="muted">
          {count} {count === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="cart-list">
        {items.length === 0 ? (
          <div className="empty">
            Venda vazia.
            <br />
            Adicione os itens do cliente.
          </div>
        ) : (
          items.map((item) => (
            <div className="cart-item" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <br />
                <span className="muted">{formatBRL(item.price)} cada</span>
              </div>
              <div className="qty">
                <button type="button" onClick={() => onChangeQty(item.id, -1)}>
                  −
                </button>
                <strong>{item.qty}</strong>
                <button type="button" onClick={() => onChangeQty(item.id, 1)}>
                  +
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <h3>Pagamento recebido</h3>
      <div className="payment-grid">
        {PAYMENTS.map((method) => (
          <button
            key={method}
            type="button"
            className={payment === method ? 'selected' : ''}
            onClick={() => onSelectPayment(method)}
          >
            {method}
          </button>
        ))}
      </div>

      <div className="notice">
        Após montar o pedido, confirme o pagamento no caixa. Só então entregue a senha física e
        informe o número liberado ao cliente.
      </div>

      <div className="total">
        <span>Total</span>
        <span>{formatBRL(total)}</span>
      </div>

      <button type="button" className="btn-primary big-action" onClick={onConfirm}>
        Confirmar pedido
      </button>
    </aside>
  )
}
