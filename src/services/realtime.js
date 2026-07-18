// Realtime dos pedidos (#57 / #59b) — camada de VELOCIDADE, nao de garantia.
//
// A tabela `pedidos` esta na publication `supabase_realtime` nos dois projetos,
// entao o servidor empurra as mudancas em vez de a gente esperar a proxima
// volta do polling. Mas o polling CONTINUA ligado de proposito: numa praia com
// sinal oscilando, websocket cai calado — a aba acha que esta ouvindo e nao
// chega evento nenhum. O polling e a rede de seguranca embaixo.
//
// Nao tentamos aplicar o payload do evento no estado local. So avisamos "mudou
// alguma coisa" e quem manda recarrega a lista inteira. E mais simples e evita
// divergencia entre o que veio no evento e o que esta no banco.
//
// `pedido_itens` NAO precisa estar na publication: item so nasce junto com o
// pedido (RPC create_order, uma transacao) e mudanca de status e update em
// `pedidos`. O evento de `pedidos` ja cobre os dois casos, e o refetch traz os
// itens junto.

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

let channel = null

// Assina as mudancas de pedidos do tenant. Devolve a funcao de desinscricao.
export function subscribeOrders(tenantId, onChange) {
  if (!isSupabaseConfigured || !supabase || !tenantId) return () => {}

  // Uma assinatura por vez: trocar de tenant derruba a anterior.
  unsubscribeOrders()

  channel = supabase
    .channel('pedidos-' + tenantId)
    .on(
      'postgres_changes',
      {
        event: '*', // insert (venda nova), update (chamado/entregue/cancelado)
        schema: 'public',
        table: 'pedidos',
        filter: 'tenant_id=eq.' + tenantId,
      },
      () => {
        onChange()
      },
    )
    .subscribe()

  return unsubscribeOrders
}

export function unsubscribeOrders() {
  if (!channel) return
  try {
    supabase.removeChannel(channel)
  } catch {
    // best-effort: se a conexao ja caiu, nao ha o que remover
  }
  channel = null
}
