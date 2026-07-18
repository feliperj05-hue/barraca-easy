// Estado real de conexao com a nuvem (#59b).
//
// Por que nao usar `navigator.onLine` sozinho: ele so diz se a placa de rede
// esta associada a alguma rede. Em wi-fi de quiosque/praia o aparelho fica
// "online" sem internet nenhuma, e o indicador mentiria bem na hora em que o
// operador mais precisa dele.
//
// Aqui a fonte da verdade e o resultado das chamadas de verdade ao Supabase:
// quem faz requisicao reporta sucesso ou falha de rede, e o estado sai disso.
// `navigator.onLine` entra so como sinal auxiliar: quando ele diz que caiu, e
// porque caiu mesmo (o falso negativo dele e raro; o falso positivo e comum).

import { outboxCount } from './offlineDb.js'

const EVENT = 'barraca:netstatus'

const state = {
  online: true, // otimista ate a primeira evidencia em contrario
  lastOkAt: null,
  pending: 0,
}

function emit() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { ...state } }))
}

export function getNetStatus() {
  return { ...state }
}

export function subscribeNetStatus(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = (e) => callback(e.detail)
  window.addEventListener(EVENT, handler)
  callback({ ...state })
  return () => window.removeEventListener(EVENT, handler)
}

// Chamado por quem conversa com o servidor. `ok` = a resposta chegou.
export function reportNetResult(ok) {
  const was = state.online
  state.online = Boolean(ok)
  if (ok) state.lastOkAt = Date.now()
  if (was !== state.online) emit()
}

// Recontagem da fila de escrita pendente (vendas/alteracoes que nao subiram).
export async function refreshPending() {
  try {
    const n = await outboxCount()
    if (n !== state.pending) {
      state.pending = n
      emit()
    }
    return n
  } catch {
    return state.pending
  }
}

let started = false

// Liga os sinais auxiliares e a recontagem periodica da fila.
export function initNetStatus() {
  if (started || typeof window === 'undefined') return
  started = true

  window.addEventListener('offline', () => reportNetResult(false))
  // `online` do navegador nao prova internet — nao marcamos como conectado
  // aqui. A proxima requisicao real e que decide.
  window.addEventListener('barraca:synced', () => {
    refreshPending()
  })

  refreshPending()
  setInterval(refreshPending, 5000)
}
