// Registro do service worker e controle de atualizacao de versao
// (issue #49, corrigido na #56 · parte do #35 · epic #26).
//
// So roda em build de producao: em `npm run dev` o SW atrapalharia o HMR do
// Vite e poderia servir bundle velho. Tudo aqui e best-effort — se o navegador
// nao suportar SW, o app continua funcionando normalmente (so nao instala).
//
// REGRA DE OURO: este modulo NUNCA recarrega a pagina por conta propria.
// O carrinho do caixa vive so em memoria (`useState` em Cashier.jsx); um reload
// no meio de um pedido apagaria a venda com a fila esperando. Entao a gente
// detecta a versao nova, avisa a UI, e so troca quando o operador mandar.

const SW_URL = '/sw.js'

// De quanto em quanto tempo perguntamos ao servidor se saiu versao nova.
// O navegador so checa sozinho na carga da pagina e em navegacao de verdade —
// e este app e SPA (troca de tela nao gera navegacao). Sem esta checagem, um
// tablet aberto 8h no Caixa nunca ficaria sabendo de um deploy.
const CHECK_INTERVAL_MS = 30 * 60 * 1000

let registration = null
let updateReady = false
let notify = null
let applying = false

// A UI se inscreve para saber quando existe versao nova esperando.
export function onUpdateReady(callback) {
  notify = callback
  if (updateReady) callback()
  return () => {
    notify = null
  }
}

function markReady() {
  if (updateReady) return
  updateReady = true
  if (notify) notify()
}

// Chamado pela faixa de atualizacao, por acao explicita do operador.
// So aqui a pagina recarrega.
export function applyUpdate() {
  const waiting = registration && registration.waiting
  if (!waiting || applying) return
  applying = true

  // O reload acontece quando o SW novo assume o controle. Sem isso, a aba
  // continuaria rodando o JS antigo.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
  waiting.postMessage({ type: 'SKIP_WAITING' })
}

function watch(reg) {
  // Versao nova ja esperando de uma sessao anterior.
  if (reg.waiting && navigator.serviceWorker.controller) markReady()

  reg.addEventListener('updatefound', () => {
    const installing = reg.installing
    if (!installing) return
    installing.addEventListener('statechange', () => {
      // "installed" com controller ja existente = e atualizacao, nao a
      // primeira instalacao. Na primeira, o SW assume direto e nao ha o que
      // avisar.
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        markReady()
      }
    })
  })
}

function scheduleChecks(reg) {
  const check = () => {
    reg.update().catch(() => {
      // Offline ou servidor fora: tenta de novo na proxima janela.
    })
  }

  setInterval(check, CHECK_INTERVAL_MS)

  // Voltou pro primeiro plano (destravou o tablet, trocou de app): bom momento
  // para checar, e nao custa nada.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

export function registerServiceWorker() {
  if (import.meta.env.DEV) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_URL)
      .then((reg) => {
        registration = reg
        watch(reg)
        scheduleChecks(reg)
      })
      .catch(() => {
        // Sem SW o app so perde instalacao/offline shell; nao quebra a venda.
      })
  })
}
