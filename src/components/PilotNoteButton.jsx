import { useState } from 'react'
import { CATEGORIAS, anotar } from '../services/pilotLog.js'

// Botao de "deu problema" no cabecalho (issue #77, piloto #35).
//
// A regra que desenhou esta tela: com fila na frente, ninguem escreve
// relatorio. Entao o caminho curto tem que bastar — abrir e bater na categoria
// ja registra e fecha. Dois toques, sem teclado. O campo de texto fica
// escondido embaixo pra quem tiver folga, e nunca e obrigatorio.
//
// A hora, a tela em que a pessoa estava, o estado da conexao e quantas vendas
// estavam na fila vao junto sem ninguem digitar nada — e isso que transforma
// "travou" em algo que da pra investigar depois.
export default function PilotNoteButton({ tela, notify }) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')

  function fechar() {
    setAberto(false)
    setTexto('')
  }

  // Um caminho so: a categoria registra, levando junto o texto se houver.
  function registrar(categoria) {
    anotar(categoria, texto, { tela })
    fechar()
    if (notify) notify('Anotado. Obrigado!')
  }

  if (!aberto) {
    return (
      <button
        type="button"
        className="icon-btn pilot-note-btn"
        onClick={() => setAberto(true)}
        title="Anotar um problema"
        aria-label="Anotar um problema"
      >
        <span aria-hidden="true">📣</span>
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Anotar um problema">
      <div className="modal pilot-note-modal">
        <h2>O que aconteceu?</h2>
        <p>Toque no que mais parece. Não precisa escrever nada.</p>
        <div className="pilot-note-options">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="pilot-note-option"
              onClick={() => registrar(c.id)}
            >
              <span className="pilot-note-icon" aria-hidden="true">
                {c.icone}
              </span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <details className="pilot-note-extra">
          <summary>Quero escrever o que houve (opcional)</summary>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ex.: o pedido da senha 012 sumiu da produção"
          />
          <p className="pilot-note-hint">
            Escreveu? Agora toque na opção lá em cima que mais combina — o texto vai junto.
          </p>
        </details>
        <button type="button" className="btn-ghost" onClick={fechar}>
          Deixa pra lá
        </button>
      </div>
    </div>
  )
}
