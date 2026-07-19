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
export default function CancelSubscriptionDialog({ subscription, onConfirm, onClose, busy }) {
  const [motivo, setMotivo] = useState('')
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

        <div className="modal-actions">
          {/* O botao de cancelar a assinatura NAO pode depender de nada:
              nem de motivo preenchido, nem de checkbox, nem de leitura de
              aviso. Só `busy`, que e a chamada em andamento. */}
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={() => onConfirm(motivo)}
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
