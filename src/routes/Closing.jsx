import { summarize } from '../services/closingService.js'
import { formatBRL } from '../utils/money.js'

export default function Closing({ orders }) {
  const s = summarize(orders)

  return (
    <section>
      <div className="hero">
        <div>
          <h2>Fechamento do dia</h2>
          <p>Resumo das vendas confirmadas, pagamentos recebidos e status de entrega.</p>
        </div>
        <div className="hero-card">
          <span>Total vendido</span>
          <strong>{formatBRL(s.total)}</strong>
        </div>
      </div>

      <div className="summary-grid">
        <div className="metric">
          <span>Vendas confirmadas</span>
          <strong>{s.count}</strong>
        </div>
        <div className="metric">
          <span>Entregues</span>
          <strong>{s.delivered}</strong>
        </div>
        <div className="metric">
          <span>Pendentes</span>
          <strong>{s.pending}</strong>
        </div>
        <div className="metric">
          <span>Ticket médio</span>
          <strong>{formatBRL(s.average)}</strong>
        </div>
      </div>

      <div className="two-cols">
        <div className="panel">
          <div className="panel-title">
            <h2>Por pagamento</h2>
          </div>
          {s.byPayment.length === 0 ? (
            <div className="empty">Nenhuma venda confirmada ainda.</div>
          ) : (
            s.byPayment.map((row) => (
              <div className="summary-row" key={row.method}>
                <strong>{row.method}</strong>
                <span>{formatBRL(row.value)}</span>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <h2>Por produto</h2>
          </div>
          {s.byProduct.length === 0 ? (
            <div className="empty">Nenhum item vendido ainda.</div>
          ) : (
            s.byProduct.map((row) => (
              <div className="summary-row" key={row.name}>
                <strong>
                  {row.name}
                  <br />
                  <span className="muted">{row.qty} un.</span>
                </strong>
                <span>{formatBRL(row.total)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {s.cancelled > 0 && (
        <p className="muted" style={{ marginTop: 16 }}>
          {s.cancelled} pedido(s) cancelado(s) — fora do faturamento.
        </p>
      )}
    </section>
  )
}
