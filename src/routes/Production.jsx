import OrderCard from '../components/OrderCard.jsx'
import { getOpenOrders } from '../services/orderService.js'

export default function Production({ orders, onCall, onDeliver, onCancel }) {
  const openOrders = getOpenOrders(orders)

  return (
    <section>
      <div className="hero">
        <div>
          <h2>Fila de produção</h2>
          <p>
            Os pedidos aparecem na ordem da senha. A equipe chama a senha física e marca como
            entregue.
          </p>
        </div>
        <div className="hero-card">
          <span>Pedidos pendentes</span>
          <strong>{openOrders.length}</strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Pedidos em aberto</h2>
        </div>
        <div className="orders">
          {openOrders.length === 0 ? (
            <div className="empty">Nenhum pedido em aberto agora.</div>
          ) : (
            openOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onCall={onCall}
                onDeliver={onDeliver}
                onCancel={onCancel}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
