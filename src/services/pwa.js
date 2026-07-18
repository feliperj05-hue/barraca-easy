// Registro do service worker (issue #49, parte do #35 · epic #26).
//
// So roda em build de producao: em `npm run dev` o SW atrapalharia o HMR do
// Vite e poderia servir bundle velho. Tudo aqui e best-effort — se o navegador
// nao suportar SW, o app continua funcionando normalmente (so nao instala).

const SW_URL = '/sw.js'

// Quando sai deploy novo, o SW novo fica "waiting" ate todas as abas fecharem.
// No tablet da barraca a aba fica aberta o dia inteiro, entao pedimos a troca
// na hora e recarregamos uma unica vez.
function handleUpdate(registration) {
  const waiting = registration.waiting
  if (!waiting) return
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
  waiting.postMessage({ type: 'SKIP_WAITING' })
}

export function registerServiceWorker() {
  if (import.meta.env.DEV) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_URL)
      .then((registration) => {
        if (registration.waiting) handleUpdate(registration)
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // "installed" com controller ja existente = versao nova esperando.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              handleUpdate(registration)
            }
          })
        })
      })
      .catch(() => {
        // Sem SW o app so perde instalacao/offline shell; nao quebra a venda.
      })
  })
}
