import { formatBRL } from '../utils/money.js'

export default function OrderCard({ order, onCall, onDeliver, onCancel }) {
  const called = order.status === 'chamado'
  return (
    <div className="order-card">
      <div className="order-head">
        <div className="ticket-badge">{order.ticket}</div>
        <div>
          <strong>{formatBRL(order.total)}</strong>
          <br />
          <span className="muted">{order.payment}</span>
        </div>
        <span className={'status' + (called ? ' called' : '')}>
          {called ? 'Chamado' : 'Aguardando'}
        </span>
      </div>

      <div className="items">
        {order.items.map((item, i) => (
          <div key={i}>
            {item.qty}x {item.name}
          </div>
        ))}
      </div>

      <div className="actions">
        {order.status === 'aguardando' && (
          <button type="button" className="btn-primary" onClick={() => onCall(order.id)}>
            Chamar senha
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={() => onDeliver(order.id)}>
          Entregue / OK
        </button>
        <button type="button" className="btn-danger" onClick={() => onCancel(order.id)}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
