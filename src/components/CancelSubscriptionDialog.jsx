import { useState } from 'react'
import { previsaoDeCancelamento } from '../services/subscriptionService.js'

// Confirmacao do cancelamento self-service (#115).
//
// COMPONENTE SEPARADO DE PROPOSITO. Ele e o passo 4 de 4 do fluxo, e e o passo
// que o juridico vai querer auditar linha por linha. Morando num arquivo so
// dele, da para renderizar isoladamente no teste (`npm run cancelamento`) e
// provar o que ele tem e, principalmente, o que ele NAO tem.
//
// O QUE ESTE DIALOGO NAO PODE GANHAR NUNCA:
//
//   - motivo obrigatorio (o campo existe, mas sai vazio sem reclamar)
//   - oferta de desconto, "espera!", "tem certeza mesmo?" em cascata
//   - "fale com o suporte", telefone, e-mail ou chamado para concluir
//   - digitar o nome da barraca, senha de novo, qualquer confirmacao datilografada
//   - segundo dialogo depois deste
//
// A regra e "cancelar tem que ser tao simples quanto contratar". Contratar sao
// 3 toques, sem confirmacao nenhuma. Cancelar sao 4, e o quarto e ESTE botao.
// Um passo a mais que contratar e o teto — e ele existe porque cancelar e
// destrutivo e contratar nao. Qualquer coisa acrescentada aqui estoura o teto.
export default function CancelSubscriptionDialog({ subscription, onConfirm, onClose, busy, erro }) {
  const [motivo, setMotivo] = useState('')
  // Natureza declarada pelo cliente (#122): 'resilicao' ou 'arrependimento'.
  // Comeca vazia de proposito -- nao marcar nada por padrao e a unica forma
  // de nao inventar uma declaracao que o cliente nao fez.
  const [natureza, setNatureza] = useState('')
  const previsao = previsaoDeCancelamento(subscription)

  return (
    <div className="modal-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="modal cancelar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancelar-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cancelar-titulo">Cancelar assinatura</h3>

        {/* O que vai acontecer, ANTES de confirmar. Esconder isto ate depois do
            clique seria pedir decisao no escuro justamente na hora que mais
            importa para o cliente. */}
        <p className="cancelar-efeito">{previsao ? previsao.texto : ''}</p>

        <p className="muted small">
          Seus pedidos, produtos e fechamentos continuam guardados. Nada é apagado
          pelo cancelamento.
        </p>

        {/* Escolha OPCIONAL (#122). Serve so pra deixar registrado o que o
            cliente quis dizer com o pedido de saida -- NAO muda o efeito do
            cancelamento (o periodo ja pago continua rodando igual nos dois
            casos, porque a devolucao ainda nao existe) e NAO trava o botao
            se ficar sem marcar. */}
        <fieldset className="cancelar-natureza">
          <legend>
            Qual frase combina mais com o motivo? <em>(opcional)</em>
          </legend>
          <label>
            <input
              type="radio"
              name="cancelar-natureza"
              value="resilicao"
              checked={natureza === 'resilicao'}
              onChange={() => setNatureza('resilicao')}
            />
            Só quero parar de usar daqui pra frente
          </label>
          <label>
            <input
              type="radio"
              name="cancelar-natureza"
              value="arrependimento"
              checked={natureza === 'arrependimento'}
              onChange={() => setNatureza('arrependimento')}
            />
            Me arrependi da contratação
          </label>
        </fieldset>

        <label className="cancelar-motivo" htmlFor="cancelar-motivo">
          <span>
            Quer contar o motivo? <em>(opcional — pode deixar em branco)</em>
          </span>
          <textarea
            id="cancelar-motivo"
            rows={2}
            value={motivo}
            maxLength={500}
            placeholder="Se quiser, escreva. Não é obrigatório."
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>

        {/* #120: o erro tem que aparecer AQUI DENTRO. O paragrafo antigo vivia
            no card, atras deste backdrop (position fixed, z-index acima) --
            o dono tocava em cancelar, o botao voltava ao normal e nada mais
            parecia acontecer, porque o aviso estava escondido atras do
            proprio dialogo que continuava aberto. */}
        {erro ? (
          <p className="auth-error cancelar-erro" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="modal-actions">
          {/* O botao de cancelar a assinatura NAO pode depender de nada:
              nem de motivo preenchido, nem de checkbox, nem de leitura de
              aviso. Só `busy`, que e a chamada em andamento. */}
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={() => onConfirm(motivo, natureza || null)}
          >
            {busy ? 'Cancelando...' : 'Sim, cancelar assinatura'}
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
