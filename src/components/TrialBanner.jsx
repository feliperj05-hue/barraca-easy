import { avisoDeTeste, diasRestantesDeTeste } from '../services/subscriptionService.js'

// Faixa de periodo de teste (#96).
//
// Por que ela mudou: antes so aparecia nos ultimos dias e so para o dono. O
// resultado foi o proprio Felipe abrir o app com uma conta em teste, nao ver
// aviso nenhum e concluir que a pessoa tinha entrado como cliente pleno. Se
// quem fez o produto nao percebeu, o cliente tambem nao percebe.
//
// Agora aparece durante o teste INTEIRO. Continua sendo faixa fina no rodape,
// nao modal: o operador esta atendendo fila e nao pode levar um pop-up na
// cara por causa de cobranca. Quem resolve isso e o dono, com calma.
export default function TrialBanner({ subscription, role, onAbrirAssinatura }) {
  const aviso = avisoDeTeste(subscription)
  if (!aviso) return null

  const dias = diasRestantesDeTeste(subscription)
  const urgente = dias != null && dias <= 2

  return (
    <div className={'trial-banner' + (urgente ? ' trial-urgente' : '')} role="status">
      <strong>{aviso}</strong>
      {role === 'dono' && onAbrirAssinatura ? (
        <button type="button" className="trial-cta" onClick={onAbrirAssinatura}>
          Ver planos
        </button>
      ) : (
        <span>Depois desse prazo é preciso assinar para continuar vendendo.</span>
      )}
    </div>
  )
}
