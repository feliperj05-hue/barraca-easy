import { useEffect, useState } from 'react'
import { TIPOS, anotar, marcarEnviada } from '../services/pilotLog.js'
import { enviarFeedback, podeEnviar } from '../services/feedbackCloud.js'

// "Fale com o desenvolvedor" (#85) — substitui o botao de megafone do piloto.
//
// O QUE MUDOU E POR QUE
//
// O megafone morava no cabecalho, do lado da engrenagem, no meio do caminho de
// quem esta operando com cliente na frente. Emoji grande, chamativo, competindo
// por atencao com o que realmente importa no balcao. Agora e uma linha de texto
// discreta no rodape: quem precisa acha, quem esta vendendo nem repara.
//
// Tambem deixou de ser so "reclame de bug". Sao tres portas — problema,
// melhoria e elogio — porque o app ja saiu do piloto e feedback bom nao e so o
// que quebrou. Elogio parece penduricalho, mas e o unico jeito de eu saber o
// que NAO devo mexer.
//
// FLUXO: um toque abre, um toque escolhe o tipo, escreve (ou nao) e envia.
// A escolha do tipo nao envia sozinha de proposito — diferente do diario do
// piloto antigo, aqui a pessoa tem algo a dizer, entao vale a segunda tela.
export default function DevFeedbackButton({ tela, contexto, notify }) {
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Fecha no Esc, como qualquer dialogo que se preze.
  useEffect(() => {
    if (!aberto) return undefined
    function onKey(e) {
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function fechar() {
    setAberto(false)
    setTipo(null)
    setTexto('')
    setEnviando(false)
  }

  // Elogio e sugestao sem texto nao dizem nada. Problema sem texto ainda diz:
  // vai com hora, tela, conexao e tamanho da fila, que muitas vezes basta pra
  // eu achar o que houve.
  const precisaTexto = tipo === 'melhoria' || tipo === 'elogio'
  const podeMandar = Boolean(tipo) && (!precisaTexto || texto.trim().length > 0)

  async function enviar() {
    if (!podeMandar || enviando) return
    setEnviando(true)

    // Grava no aparelho ANTES de tentar a rede. Quem escreve reclamacao muitas
    // vezes esta reclamando justamente da internet — o recado nao pode depender
    // dela pra sobreviver.
    const nota = anotar(tipo, texto, { tela })

    let chegou = false
    if (podeEnviar()) {
      const r = await enviarFeedback(nota, contexto)
      if (r.ok) {
        marcarEnviada(nota.id)
        chegou = true
      }
    }

    fechar()
    if (notify) {
      notify(
        chegou
          ? 'Recado enviado. Obrigado!'
          : 'Recado guardado no aparelho. Ele sobe sozinho quando der.',
      )
    }
  }

  if (!aberto) {
    return (
      <button type="button" className="dev-feedback-link" onClick={() => setAberto(true)}>
        Fale com o desenvolvedor
      </button>
    )
  }

  return (
    <div
      className="modal-backdrop show"
      role="dialog"
      aria-modal="true"
      aria-label="Fale com o desenvolvedor"
      onClick={fechar}
    >
      <div className="modal dev-feedback-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Fale com o desenvolvedor</h2>
        <p>
          Do outro lado tem gente lendo. Conte o que aconteceu, o que faltou ou o que ficou bom.
        </p>

        <div className="dev-feedback-tipos">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={'dev-feedback-tipo' + (t.id === tipo ? ' selecionado' : '')}
              aria-pressed={t.id === tipo}
              onClick={() => setTipo(t.id)}
            >
              <strong>{t.label}</strong>
              <span className="muted small">{t.hint}</span>
            </button>
          ))}
        </div>

        <label className="dev-feedback-campo">
          <span className="muted small">
            {tipo
              ? precisaTexto
                ? 'Escreva sua mensagem'
                : 'Quer contar o que houve? (opcional)'
              : 'Escolha um assunto acima pra continuar'}
          </span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            maxLength={1000}
            disabled={!tipo}
            placeholder={
              tipo === 'elogio'
                ? 'Ex.: a fila da producao ficou muito mais facil de acompanhar'
                : tipo === 'melhoria'
                  ? 'Ex.: queria ver o total do dia sem sair do caixa'
                  : 'Ex.: o pedido da senha 012 sumiu da producao'
            }
          />
        </label>

        <p className="muted small dev-feedback-nota">
          Vai junto a hora, a tela em que voce estava e como estava a conexao. Nada de senha nem
          dado de cliente.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={fechar}>
            Deixa pra lá
          </button>
          <button type="button" className="btn-ok" onClick={enviar} disabled={!podeMandar || enviando}>
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
