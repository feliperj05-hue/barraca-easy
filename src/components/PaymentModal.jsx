import { useEffect, useRef, useState } from 'react'
import { formatBRL } from '../utils/money.js'

// Popup "Aguardando pagamento" (#4). Abre após Confirmar pedido; o caixa só
// informa a senha física DEPOIS do pagamento confirmado.
export default function PaymentModal({ open, total, onClose, onConfirm }) {
  const [ticket, setTicket] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTicket('')
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Aguardando pagamento</h2>
        <p>
          Receba o pagamento do cliente no caixa. Depois de confirmado, entregue a senha física e
          informe o número liberado ao sistema.
        </p>
        <div className="modal-total">{formatBRL(total)}</div>

        <div className="field">
          <label htmlFor="modal-ticket-input">
            Número da senha física liberada ao cliente
          </label>
          <input
            id="modal-ticket-input"
            ref={inputRef}
            maxLength={6}
            inputMode="numeric"
            placeholder="Ex: 027"
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(ticket)
            }}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Voltar ao pedido
          </button>
          <button type="button" className="btn-secondary" onClick={() => onConfirm(ticket)}>
            Pagamento confirmado
          </button>
        </div>
      </div>
    </div>
  )
}
