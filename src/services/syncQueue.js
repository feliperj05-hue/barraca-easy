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

import { outboxAll, outboxDelete, outboxUpdate, outboxCount, incidentAdd } from './offlineDb.js'

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
export function isSessionError(err) {
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


// O que NAO deve chegar ao operador como erro de venda: nem falha de rede, nem
// credencial vencida (#75). Nos dois casos o servidor nao aplicou a operacao
// por motivo temporario, entao ela vai pra fila e sobe depois — a venda segue.
//
// O caso que a `isOfflineError` sozinha nao pega: o sinal volta, mas o token
// ainda nao renovou (a lib tem cooldown de 60s apos um refresh que falhou).
// A requisicao sai, chega no servidor e volta **401 / JWT expired**. Isso tem
// cara de resposta de negocio e nao e: e a mesma falha de transporte de antes,
// so que com resposta. Sem esta guarda, a venda estourava na tela do operador.
export function isDeferrableError(err) {
  return isOfflineError(err) || isSessionError(err)
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
        if (isOfflineError(err) || isSessionError(err)) {
          break // temporario: mantem a fila e tenta na proxima
        }
        if (isDuplicateConflict(err)) {
          // O handler de `create` ja tenta reatribuir a senha (#59). Chegar
          // aqui significa que nem isso resolveu — entao a venda sai da fila,
          // mas NUNCA em silencio: fica registrada para o operador ver.
          await recordFailure(op, err)
          await outboxDelete(op.seq)
          synced = true
          continue
        }
        // erro persistente inesperado: conta a tentativa e descarta no limite
        op.attempts = (op.attempts || 0) + 1
        if (op.attempts >= MAX_ATTEMPTS) {
          // Desistir e aceitavel; desistir calado, nao. Registra antes de sair.
          await recordFailure(op, err)
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

// Registra que uma operacao nao pode ser aplicada. Vale para venda (create) e
// para transicao de status. O `payload` do create guarda senha e total, que e
// o que o operador precisa para achar o pedido no mundo real.
async function recordFailure(op, err) {
  await incidentAdd({
    type: 'op-failed',
    opType: op.type,
    tenantId: op.tenantId,
    ticket: (op.payload && op.payload.ticket) || null,
    total: (op.payload && op.payload.total) || null,
    reason: String((err && err.message) || err || 'erro desconhecido'),
  })
}

// De quanto em quanto tempo insistimos na fila enquanto houver pendencia.
// O evento `online` do navegador nao basta: em wi-fi de quiosque o aparelho
// fica "conectado" sem internet, o evento nunca dispara de novo e a fila
// ficaria parada ate reabrir o app — com venda dentro dela.
const RETRY_INTERVAL_MS = 30000

// Liga o disparo automatico: ao voltar a conexao, no boot e por tempo.
let initialized = false
export function initSync() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  window.addEventListener('online', () => {
    flushQueue()
  })
  setInterval(async () => {
    // So acorda a rede se realmente houver o que subir.
    if ((await outboxCount()) > 0) flushQueue()
  }, RETRY_INTERVAL_MS)
  // tenta drenar o que tiver ficado de sessoes anteriores
  flushQueue()
}
