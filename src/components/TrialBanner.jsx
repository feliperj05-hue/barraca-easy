import { avisoDeTeste } from '../services/subscriptionService.js'

// Aviso de teste chegando ao fim (#90).
//
// Aparece so nos ultimos 7 dias e como faixa fina no rodape: o operador esta
// atendendo fila, nao pode levar um modal na cara por causa de cobranca. Quem
// resolve isso e o dono, com calma, na tela de assinatura.
export default function TrialBanner({ subscription, role }) {
  const aviso = avisoDeTeste(subscription)
  if (!aviso || role !== 'dono') return null
  return (
    <div className="trial-banner" role="status">
      <strong>{aviso}</strong>
      <span>Veja em Configurações › Minha assinatura como continuar.</span>
    </div>
  )
}
