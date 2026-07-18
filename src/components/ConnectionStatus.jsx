import { useEffect, useState } from 'react'
import { subscribeNetStatus } from '../services/netStatus.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'

// Selo de conexao + vendas nao enviadas (#59b).
//
// Fica no cabecalho, entao aparece em TODAS as telas de operacao (Caixa e
// Producao inclusive). O indicador antigo vivia dentro de Configuracoes, tela
// que ninguem abre no meio do expediente, e checava a conexao uma unica vez ao
// montar — passava a mentir "conectada" assim que o sinal caia.
//
// Cuidado de vocabulario: a Producao ja usa "pedidos pendentes" para status do
// pedido (aguardando/chamado). Aqui falamos "nao enviados", que e outra coisa
// — dado que ainda nao subiu pro servidor. Dois nomes diferentes de proposito.
export default function ConnectionStatus() {
  const [status, setStatus] = useState({ online: true, pending: 0 })

  useEffect(() => subscribeNetStatus(setStatus), [])

  // Sem nuvem configurada o app e local por definicao: nao ha o que sincronizar
  // e um selo de conexao so confundiria.
  if (!isSupabaseConfigured) return null

  const { online, pending } = status
  const state = !online ? 'offline' : pending > 0 ? 'syncing' : 'ok'
  const label =
    state === 'offline'
      ? 'Sem conexão'
      : state === 'syncing'
        ? 'Enviando...'
        : 'Conectado'

  return (
    <div className="conn-status" data-state={state} title={label}>
      <span className="conn-dot" aria-hidden="true" />
      <span className="conn-label">{label}</span>
      {pending > 0 && (
        <span className="conn-pending">
          {pending} {pending === 1 ? 'venda não enviada' : 'vendas não enviadas'}
        </span>
      )}
    </div>
  )
}
