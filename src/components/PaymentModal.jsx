import { useEffect, useState } from 'react'
import { formatBRL } from '../utils/money.js'
import NumericKeypad from './NumericKeypad.jsx'

// Popup "Aguardando pagamento" (#4). Abre após Confirmar pedido; o caixa só
// informa a senha física DEPOIS do pagamento confirmado.
//
// Duas caras, conforme o modo de senha (#79):
//
// - **manual** (padrão): o caixa informa o número do papel que entregou, no
//   teclado numérico do próprio app (#81).
// - **automática**: o sistema já escolheu o número e mostra em corpo grande.
//   Não há o que digitar — só ler alto e confirmar. O campo some de propósito:
//   campo editável convida a mexer, e mexer aqui quebra a sequência.
//
// Sobre não existir `<input>` no modo manual (#81): o teclado do Android
// aparece porque um campo de texto recebeu foco. `readonly` costuma segurar,
// mas depende do fabricante e da versão do IME — e a queixa do Felipe veio de
// tablet real, não de teoria. Sem campo focável não há teclado do sistema pra
// aparecer, ponto. O número digitado vive num `aria-live`, então leitor de
// tela continua narrando cada dígito.
export default function PaymentModal({ open, total, onClose, onConfirm, autoTicket }) {
  const [ticket, setTicket] = useState('')
  const auto = Boolean(autoTicket)

  useEffect(() => {
    if (open) setTicket('')
  }, [open])

  if (!open) return null

  const confirmar = () => onConfirm(auto ? autoTicket : ticket)

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
          <div className="ticket-entry">
            <span className="ticket-entry-label" id="ticket-entry-label">
              Número da senha física liberada ao cliente
            </span>
            <output
              className={'ticket-entry-display' + (ticket ? '' : ' empty')}
              aria-labelledby="ticket-entry-label"
              aria-live="polite"
            >
              {ticket || 'Digite a senha'}
            </output>
            <NumericKeypad
              value={ticket}
              onChange={setTicket}
              onConfirm={confirmar}
              maxLength={6}
            />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Voltar ao pedido
          </button>
          <button type="button" className="btn-ok" onClick={confirmar}>
            Pagamento confirmado
          </button>
        </div>
      </div>
    </div>
  )
}
