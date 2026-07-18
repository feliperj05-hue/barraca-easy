import { useState } from 'react'
import {
  getTicketMode,
  setTicketMode,
  TICKET_MODE_MANUAL,
  TICKET_MODE_AUTO,
} from '../services/settingsService.js'

// Como a senha do cliente é definida (#79).
//
// Duas escolhas, e só. Manual é o padrão porque é como a barraca sempre
// trabalhou — ninguém pode ter o comportamento trocado embaixo do pé só por
// atualizar o app.
//
// A troca fica travada enquanto houver venda no caixa aberto, e isso não é
// frescura: "027" (manual) e "0027" (automática) são textos diferentes, e a
// trava de senha repetida do banco compara texto. Misturar as duas larguras no
// mesmo expediente deixaria passar dois clientes com a senha 27 — cada um
// achando que a próxima chamada é a dele.
export default function TicketModeCard({ notify, onChange, vendasNoCaixa }) {
  const [mode, setMode] = useState(() => getTicketMode())
  const travado = vendasNoCaixa > 0

  function escolher(novo) {
    if (novo === mode) return
    if (travado) {
      notify('Feche o caixa antes de trocar o tipo de senha.')
      return
    }
    setMode(setTicketMode(novo))
    if (onChange) onChange(novo)
    notify(
      novo === TICKET_MODE_AUTO
        ? 'Senha automática ligada. A próxima venda sai como 0001.'
        : 'Senha manual ligada. O caixa volta a informar o número do papel.',
    )
  }

  return (
    <div className="panel settings-panel">
      <div className="panel-title">
        <h2>Senha do cliente</h2>
      </div>

      <p className="muted">
        Quem decide o número da senha: você, olhando o papel que entregou, ou o próprio sistema, em
        ordem.
      </p>

      <div className="ticket-mode-options">
        <button
          type="button"
          className={'ticket-mode-option' + (mode === TICKET_MODE_MANUAL ? ' selected' : '')}
          aria-pressed={mode === TICKET_MODE_MANUAL}
          onClick={() => escolher(TICKET_MODE_MANUAL)}
        >
          <span className="ticket-mode-sample">027</span>
          <strong>Senha manual</strong>
          <span className="muted">
            Você entrega a senha de papel e digita o número no sistema. Três dígitos. É como
            funciona hoje.
          </span>
        </button>

        <button
          type="button"
          className={'ticket-mode-option' + (mode === TICKET_MODE_AUTO ? ' selected' : '')}
          aria-pressed={mode === TICKET_MODE_AUTO}
          onClick={() => escolher(TICKET_MODE_AUTO)}
        >
          <span className="ticket-mode-sample">0001</span>
          <strong>Senha automática</strong>
          <span className="muted">
            O sistema dá o número em ordem, começando do 0001. Quatro dígitos. Você só lê o número
            para o cliente.
          </span>
        </button>
      </div>

      {travado ? (
        <p className="settings-note warn">
          Tem {vendasNoCaixa} {vendasNoCaixa === 1 ? 'venda' : 'vendas'} no caixa aberto. Feche o
          caixa para trocar — misturar os dois tipos no mesmo dia pode gerar duas senhas iguais.
        </p>
      ) : (
        <p className="settings-note">
          <strong>Nos dois casos a contagem zera quando você fecha o caixa.</strong> Na automática,
          a próxima venda volta para 0001. Na manual, os números do dia são liberados e você pode
          usar o mesmo papel de novo.
        </p>
      )}
    </div>
  )
}
