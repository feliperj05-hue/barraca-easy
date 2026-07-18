import { useEffect, useRef, useState } from 'react'
import { formatBRL } from '../utils/money.js'

// Popup "Aguardando pagamento" (#4). Abre após Confirmar pedido; o caixa só
// informa a senha física DEPOIS do pagamento confirmado.
//
// Duas caras, conforme o modo de senha (#79):
//
// - **manual** (padrão): o caixa digita o número do papel que entregou. É o
//   comportamento de sempre, sem uma vírgula de diferença.
// - **automática**: o sistema já escolheu o número e mostra ele em corpo
//   grande. Não há o que digitar — só ler alto e confirmar. O campo some de
//   propósito: campo editável convida a mexer, e mexer aqui quebra a
//   sequência.
export default function PaymentModal({ open, total, onClose, onConfirm, autoTicket }) {
  const [ticket, setTicket] = useState('')
  const inputRef = useRef(null)
  const auto = Boolean(autoTicket)

  useEffect(() => {
    if (open) {
      setTicket('')
      if (auto) return undefined
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
    return undefined
  }, [open, auto])

  if (!open) return null

  return (
    <div className="modal-backdrop show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Aguardando pagamento</h2>
        <p>
          {auto
            ? 'Receba o pagamento do cliente no caixa. Depois de confirmado, informe ao cliente a senha abaixo.'
            : 'Receba o pagamento do cliente no caixa. Depois de confirmado, entregue a senha física e informe o número liberado ao sistema.'}
        </p>
        <div className="modal-total">{formatBRL(total)}</div>

        {auto ? (
          <div className="auto-ticket-box">
            <span className="muted">Senha deste cliente</span>
            <strong className="auto-ticket-number">{autoTicket}</strong>
            <span className="muted small">O sistema já reservou. Diga o número ao cliente.</span>
          </div>
        ) : (
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
        )}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Voltar ao pedido
          </button>
          <button
            type="button"
            className="btn-ok"
            onClick={() => onConfirm(auto ? autoTicket : ticket)}
          >
            Pagamento confirmado
          </button>
        </div>
      </div>
    </div>
  )
}
