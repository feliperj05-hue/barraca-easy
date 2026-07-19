import { diasRestantesDeTeste } from '../services/subscriptionService.js'

// Selo permanente de periodo de teste no cabecalho (#96).
//
// A faixa do rodape avisa, mas some do campo de visao de quem esta olhando o
// pedido. Este selo fica junto do nome da barraca, em toda tela e para todo
// mundo (dono e operador): o objetivo do requisito e que seja DIFICIL de nao
// ver. E texto curto, no cabecalho, entao nao rouba espaco do balcao nem
// interrompe ninguem no meio de uma venda.
export default function TrialBadge({ subscription }) {
  if (!subscription || subscription.status_assinatura !== 'teste') return null

  const dias = diasRestantesDeTeste(subscription)
  if (dias == null) return null

  const texto =
    dias < 0
      ? 'Teste encerrado'
      : dias === 0
        ? 'Teste · último dia'
        : `Teste · ${dias} dia${dias === 1 ? '' : 's'}`

  return (
    <span className={'trial-badge' + (dias <= 2 ? ' trial-badge-urgente' : '')}>{texto}</span>
  )
}
