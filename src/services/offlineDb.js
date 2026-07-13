// Camada de persistencia offline em IndexedDB (issue #34, epic #26 · Fase 1).
//
// Dois papeis, dois object stores:
// - `cache`: ultimo estado bom conhecido de cada colecao (ex.: 'orders'),
//   para a leitura funcionar offline a partir do cache.
// - `outbox`: fila de escrita (create/call/deliver/cancel) que nao subiu por
//   estar sem conexao; e drenada quando a rede volta (ver syncQueue.js).
//
// Tudo isolado atras de Promises. Se o navegador nao tiver IndexedDB (ou o
// acesso falhar, ex.: modo privado antigo), as funcoes degradam para no-op /
// vazio — o app continua funcionando, so sem o cache offline.

const DB_NAME = 'barraca-easy-offline'
const DB_VERSION = 1
const CACHE_STORE = 'cache'
const OUTBOX_STORE = 'outbox'

let dbPromise = null

function hasIndexedDB() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null
}

function openDb() {
  if (!hasIndexedDB()) return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    let req
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE) // chave = nome da colecao (string)
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'seq', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null) // falhou? segue sem cache, sem quebrar o app
  })
  return dbPromise
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store)
}

function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ----- Cache (leitura offline) -----

export async function cacheGet(key) {
  const db = await openDb()
  if (!db) return null
  try {
    const value = await asPromise(tx(db, CACHE_STORE, 'readonly').get(key))
    return value ?? null
  } catch {
    return null
  }
}

export async function cacheSet(key, value) {
  const db = await openDb()
  if (!db) return
  try {
    await asPromise(tx(db, CACHE_STORE, 'readwrite').put(value, key))
  } catch {
    // best-effort: se nao deu para cachear, tudo bem
  }
}

// ----- Outbox (fila de escrita) -----

// Enfileira uma operacao pendente. Retorna o `seq` gerado (ordem FIFO).
export async function outboxAdd(op) {
  const db = await openDb()
  if (!db) return null
  try {
    return await asPromise(tx(db, OUTBOX_STORE, 'readwrite').add({ ...op, ts: Date.now() }))
  } catch {
    return null
  }
}

// Lista as operacoes pendentes em ordem de insercao (FIFO por `seq`).
export async function outboxAll() {
  const db = await openDb()
  if (!db) return []
  try {
    const all = await asPromise(tx(db, OUTBOX_STORE, 'readonly').getAll())
    return (all || []).sort((a, b) => a.seq - b.seq)
  } catch {
    return []
  }
}

export async function outboxDelete(seq) {
  const db = await openDb()
  if (!db) return
  try {
    await asPromise(tx(db, OUTBOX_STORE, 'readwrite').delete(seq))
  } catch {
    // ignore
  }
}

export async function outboxUpdate(op) {
  const db = await openDb()
  if (!db) return
  try {
    await asPromise(tx(db, OUTBOX_STORE, 'readwrite').put(op))
  } catch {
    // ignore
  }
}

export async function outboxCount() {
  const items = await outboxAll()
  return items.length
}
