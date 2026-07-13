// Motor de sincronizacao best-effort (issue #34, epic #26 · Fase 1).
//
// Drena a `outbox` (fila de escrita do offlineDb) quando ha conexao. Cada tipo
// de operacao registra um handler que sabe subir aquilo para o Supabase. O
// merge/resolucao de conflito robusto e da Fase 2 (#26); aqui e best-effort:
// - Replay FIFO: opera na ordem em que a barraca registrou.
// - Erro de rede (offline) ou de sessao (auth ainda restaurando) -> para e
//   mantem a fila para a proxima tentativa (nao perde a venda).
// - Senha ja usada no servidor (conflito real) -> descarta a op e segue.
// - Qualquer outro erro persistente -> tenta ate MAX_ATTEMPTS e entao descarta,
//   para a fila nunca travar para sempre.
// - Um handler de `create` pode devolver { remap: { from, to } } (id temporario
//   local -> id real do banco); as operacoes seguintes na fila que apontavam
//   para o id temporario sao reescritas para o id real.

import { outboxAll, outboxDelete, outboxUpdate } from './offlineDb.js'

const MAX_ATTEMPTS = 5

const handlers = new Map()
let flushing = false

// Handler assincrono por tipo de operacao. fn(op) pode devolver
// { remap: { from, to } } quando resolve um id temporario.
export function registerHandler(type, fn) {
  handlers.set(type, fn)
}

// Heuristica de "estou offline / foi falha de rede" (nao um erro de negocio).
// fetch falho vira TypeError "Failed to fetch"; tambem tratamos navigator.onLine.
export function isOfflineError(err) {
  if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
    return true
  }
  if (!err) return false
  const msg = String(err.message || err)
  return /Failed to fetch|NetworkError|network|fetch|Load failed|ERR_INTERNET/i.test(msg)
}

// Erro de sessao/permissao: a fila sobreviveu a um restart e a autenticacao
// ainda nao voltou. Nao e permanente — tentamos de novo depois (nao descarta).
function isAuthError(err) {
  if (!err) return false
  const code = String(err.code || '')
  const msg = String(err.message || err)
  return (
    code === '401' ||
    code === '403' ||
    code === 'PGRST301' ||
    /jwt|not authenticated|unauthor|permission denied|row-level security|forbidden/i.test(msg)
  )
}

// Conflito real de senha ja usada no servidor: op impossivel de aplicar.
function isDuplicateConflict(err) {
  const code = String(err && err.code)
  return code === '23505' || /usada hoje/i.test(String((err && err.message) || err))
}

function online() {
  return typeof navigator === 'undefined' || !navigator || navigator.onLine !== false
}

// Drena a fila. Silencioso e reentrante-seguro (flag `flushing`).
// Retorna true se algo foi efetivamente sincronizado (para a UI recarregar).
export async function flushQueue() {
  if (flushing || !online()) return false
  flushing = true
  let synced = false
  try {
    const ops = await outboxAll()
    for (const op of ops) {
      const handler = handlers.get(op.type)
      if (!handler) {
        await outboxDelete(op.seq) // tipo desconhecido: descarta para nao travar
        continue
      }
      try {
        const result = await handler(op)
        await outboxDelete(op.seq)
        synced = true
        if (result && result.remap && result.remap.from !== result.remap.to) {
          await remapPending(ops, result.remap.from, result.remap.to)
        }
      } catch (err) {
        if (isOfflineError(err) || isAuthError(err)) {
          break // temporario: mantem a fila e tenta na proxima
        }
        if (isDuplicateConflict(err)) {
          await outboxDelete(op.seq) // servidor recusou de vez: descarta e segue
          synced = true
          continue
        }
        // erro persistente inesperado: conta a tentativa e descarta no limite
        op.attempts = (op.attempts || 0) + 1
        if (op.attempts >= MAX_ATTEMPTS) {
          await outboxDelete(op.seq)
          synced = true
          continue
        }
        await outboxUpdate(op)
        break
      }
    }
  } finally {
    flushing = false
  }
  if (synced && typeof window !== 'undefined') {
    // avisa a UI que o estado remoto mudou (App recarrega os pedidos)
    window.dispatchEvent(new CustomEvent('barraca:synced'))
  }
  return synced
}

// Reescreve as ops ainda pendentes que apontavam para o id temporario.
async function remapPending(ops, from, to) {
  for (const other of ops) {
    if (other.orderId === from) {
      other.orderId = to
      await outboxUpdate(other)
    }
  }
}

// Liga o disparo automatico: ao voltar a conexao e no boot do app.
let initialized = false
export function initSync() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  window.addEventListener('online', () => {
    flushQueue()
  })
  // tenta drenar o que tiver ficado de sessoes anteriores
  flushQueue()
}
