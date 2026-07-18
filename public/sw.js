/* Service worker do Barraca Easy (issue #49, parte do #35 · epic #26).
 *
 * Objetivo: deixar o app instalavel de verdade no tablet (o Chrome so oferece
 * o prompt de instalacao quando existe SW com handler de `fetch`) e fazer o
 * app shell abrir sem internet — cenario real de praia/feira.
 *
 * O que este SW NAO faz: cache de dados. Pedidos, produtos e fechamentos tem
 * a propria camada offline (`offlineDb` + `syncQueue`, #34). Cachear resposta
 * do Supabase aqui so criaria dado velho disfarcado de dado bom.
 *
 * Estrategias:
 * - Navegacao (HTML): network-first, cai para o index.html cacheado.
 * - Assets com hash do build (/assets/*): cache-first (sao imutaveis).
 * - Icones/manifest: stale-while-revalidate simples.
 * - Qualquer coisa nao-GET, cross-origin ou de API: passa direto pra rede.
 */

const VERSION = 'v1'
const SHELL_CACHE = `barraca-easy-shell-${VERSION}`
const ASSET_CACHE = `barraca-easy-assets-${VERSION}`
const CACHES = [SHELL_CACHE, ASSET_CACHE]

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
]

// NAO chamamos skipWaiting() aqui de proposito (#56). Se o SW novo assumisse
// sozinho, a aba seguiria rodando o JS antigo contra um cache novo — e a
// pagina precisaria recarregar numa hora imprevisivel, possivelmente no meio
// de um pedido. Quem manda trocar e o operador, pelo aviso na tela.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll e tudo-ou-nada: um icone faltando derrubaria a instalacao
      // inteira. Por isso cada URL vai individualmente, best-effort.
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => null),
          ),
        ),
      ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !CACHES.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

// A pagina pede a troca imediata quando avisamos que ha versao nova.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

function isHashedAsset(url) {
  return url.pathname.startsWith('/assets/')
}

function isShellAsset(url) {
  return /\/(manifest\.json|icon-192\.png|icon-512\.png|icon\.svg|apple-touch-icon\.png)$/.test(
    url.pathname,
  )
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response && response.ok) cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)
  return hit || (await network) || Response.error()
}

// HTML sempre tenta a rede primeiro (para pegar deploy novo). Sem rede, serve
// o index.html cacheado — como e SPA, o React resolve a rota do lado do cliente.
async function navigationHandler(request) {
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE)
      cache.put('./index.html', response.clone())
    }
    return response
  } catch {
    const cache = await caches.open(SHELL_CACHE)
    const cached = (await cache.match('./index.html')) || (await cache.match('./'))
    if (cached) return cached
    throw new Error('offline sem app shell em cache')
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // Supabase e afins: direto na rede

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request))
    return
  }
  if (isHashedAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }
  if (isShellAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE))
  }
})
