// Pedidos e fila de producao — backend-aware (issue #32, epic #26).
//
// Dois backends atras de uma API unica assincrona, escolhidos pelo ctx:
// - NUVEM (Supabase): quando ha credenciais + tenant. Pedido em `pedidos` e
//   itens em `pedido_itens`, isolados por RLS. Criacao via RPC create_order
//   (pedido + itens numa transacao). Senha unica/dia garantida pelo indice do
//   banco; cancelado libera o numero.
// - LOCAL (localStorage): fallback quando nao ha nuvem/tenant. Mantem o modelo
//   original (append-only + transicoes de status).
//
// OFFLINE (issue #34, Fase 1 · best-effort): no caminho NUVEM, quando a conexao
// cai, a leitura vem do cache em IndexedDB e a escrita entra numa fila (outbox)
// que sobe ao reconectar (ver offlineDb.js / syncQueue.js). O modo LOCAL ja e
// sincrono e imune a offline, entao nada muda la.
//
// Os helpers de leitura (getOpenOrders, isTicketTaken) sao puros sobre um array
// de pedidos ja carregado — servem aos dois backends.

import { normalizeTicket, nextFreeTicket } from '../utils/tickets.js'
import { isSameDay } from '../utils/dates.js'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { cacheGet, cacheSet, outboxAdd, incidentAdd } from './offlineDb.js'
import { registerHandler, isOfflineError } from './syncQueue.js'

const STORAGE_KEY = 'barracaEasyManualTicketState'

function isCloud(ctx) {
  return Boolean(isSupabaseConfigured && ctx && ctx.tenantId)
}

// Cache offline dos pedidos e por tenant (o aparelho pode, no limite, servir a
// barracas diferentes ao longo do tempo).
function ordersKey(tenantId) {
  return 'orders:' + tenantId
}

// --- Helpers puros (independentes de backend) ---

// Fila da producao: pedidos aguardando/chamados, ordenados por senha.
export function getOpenOrders(orders) {
  return (orders || [])
    .filter((o) => ['aguardando', 'chamado'].includes(o.status))
    .sort((a, b) => Number(a.ticket) - Number(b.ticket))
}

// Regra de senha duplicada (#5): bloqueia se ja existir uma venda ativa (nao
// cancelada) com a mesma senha no mesmo dia. Cancelada libera o numero.
export function isTicketTaken(ticket, orders) {
  const t = normalizeTicket(ticket)
  const now = new Date()
  return (orders || []).some(
    (o) => o.ticket === t && o.status !== 'cancelado' && isSameDay(o.createdAt, now),
  )
}

// Validacoes compartilhadas do payload. Retorna a senha normalizada.
function validatePayload({ items, payment, ticket }) {
  if (!items || !items.length) throw new Error('Adicione pelo menos um item.')
  if (!payment) throw new Error('Selecione a forma de pagamento.')
  if (!ticket || !String(ticket).trim()) {
    throw new Error('Informe a senha física liberada ao cliente.')
  }
  const normalized = normalizeTicket(ticket)
  // Senha sem digitos validos (ex: "abc" ou "0") normaliza para "000":
  // rejeita para nao criar pedido com senha zerada (#17).
  if (!/[1-9]/.test(normalized)) {
    throw new Error('Informe uma senha numérica válida (ex: 27).')
  }
  return normalized
}

// =====================================================================
// Backend LOCAL (localStorage)
// =====================================================================

function load() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      // storage corrompido: recomeca vazio
    }
  }
  return { orders: [] }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function localCreate({ items, payment, total, ticket }) {
  const state = load()
  if (isTicketTaken(ticket, state.orders)) {
    throw new Error(`A senha ${ticket} já foi usada hoje.`)
  }
  const now = new Date().toISOString()
  const order = {
    id: 'order-' + Date.now(),
    ticket,
    items,
    payment,
    total,
    status: 'aguardando',
    createdAt: now,
    paidAt: now,
    calledAt: null,
    deliveredAt: null,
    cancelledAt: null,
  }
  state.orders.push(order)
  save(state)
  return order
}

function localUpdateStatus(id, status, tsField) {
  const state = load()
  const order = state.orders.find((o) => o.id === id)
  if (!order) return state.orders
  order.status = status
  if (tsField) order[tsField] = new Date().toISOString()
  save(state)
  return state.orders
}

// =====================================================================
// Backend NUVEM (Supabase)
// =====================================================================

const CLOUD_SELECT =
  'id, senha, forma_pagamento, total, status, created_at, paid_at, called_at, ' +
  'delivered_at, cancelled_at, pedido_itens(produto_id, nome, categoria, preco_unit, quantidade)'

// Transicoes de status: mapeia o tipo de operacao (usado na fila offline) para
// a coluna/valor no Supabase e o campo espelho no objeto local.
const STATUS_OPS = {
  call: { status: 'chamado', col: 'called_at', localTs: 'calledAt' },
  deliver: { status: 'entregue', col: 'delivered_at', localTs: 'deliveredAt' },
  cancel: { status: 'cancelado', col: 'cancelled_at', localTs: 'cancelledAt' },
}

function mapOrder(r) {
  return {
    id: r.id,
    ticket: r.senha,
    payment: r.forma_pagamento,
    total: Number(r.total),
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    calledAt: r.called_at,
    deliveredAt: r.delivered_at,
    cancelledAt: r.cancelled_at,
    items: (r.pedido_itens || []).map((it) => ({
      id: it.produto_id,
      name: it.nome,
      category: it.categoria,
      price: Number(it.preco_unit),
      qty: it.quantidade,
      subtotal: Number(it.preco_unit) * it.quantidade,
    })),
  }
}

// Erro de senha duplicada vindo do banco (indice unico) — e de negocio, NAO
// deve virar item de fila offline.
function isDuplicateTicket(error) {
  return Boolean(error) && (error.code === '23505' || /usada hoje/i.test(error.message || ''))
}

// ----- Helpers de cache offline -----

async function cacheAppend(tenantId, order) {
  const cached = (await cacheGet(ordersKey(tenantId))) || []
  await cacheSet(ordersKey(tenantId), [...cached, order])
}

async function cacheReplace(tenantId, oldId, newOrder) {
  const cached = (await cacheGet(ordersKey(tenantId))) || []
  await cacheSet(
    ordersKey(tenantId),
    cached.map((o) => (o.id === oldId ? newOrder : o)),
  )
}

async function cachePatchStatus(tenantId, id, status, localTs) {
  const cached = (await cacheGet(ordersKey(tenantId))) || []
  await cacheSet(
    ordersKey(tenantId),
    cached.map((o) => (o.id === id ? { ...o, status, [localTs]: new Date().toISOString() } : o)),
  )
}

function optimisticOrder({ items, payment, total, ticket }) {
  const now = new Date().toISOString()
  return {
    id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    ticket,
    items,
    payment,
    total,
    status: 'aguardando',
    createdAt: now,
    paidAt: now,
    calledAt: null,
    deliveredAt: null,
    cancelledAt: null,
    pending: true, // ainda nao confirmado no servidor
  }
}

// ----- Operacoes cruas contra o Supabase (reusadas pelo replay da fila) -----

// Leitura crua do servidor, sem tocar no cache. Usada pelo replay da fila
// para descobrir quais senhas ja estao ocupadas hoje.
async function cloudFetchRaw() {
  const { data, error } = await supabase
    .from('pedidos')
    .select(CLOUD_SELECT)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapOrder)
}

async function cloudFetch(ctx) {
  try {
    const orders = await cloudFetchRaw(ctx.tenantId)
    await cacheSet(ordersKey(ctx.tenantId), orders) // atualiza o cache offline
    return orders
  } catch (err) {
    if (!isOfflineError(err)) throw err
    // offline: le do ultimo estado bom conhecido
    return (await cacheGet(ordersKey(ctx.tenantId))) || []
  }
}

async function cloudCreateRaw(tenantId, { items, payment, total, ticket }) {
  const p_itens = items.map((it) => ({
    produto_id: it.id,
    nome: it.name,
    categoria: it.category,
    preco_unit: it.price,
    quantidade: it.qty,
  }))
  const { data, error } = await supabase.rpc('create_order', {
    p_tenant_id: tenantId,
    p_senha: ticket,
    p_forma_pagamento: payment,
    p_total: total,
    p_itens,
  })
  if (error) {
    if (isDuplicateTicket(error)) throw new Error(`A senha ${ticket} já foi usada hoje.`)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  // A RPC retorna so o pedido; reanexamos os itens que acabamos de enviar.
  return mapOrder({ ...row, pedido_itens: p_itens })
}

async function cloudCreate(ctx, payload) {
  try {
    const order = await cloudCreateRaw(ctx.tenantId, payload)
    await cacheAppend(ctx.tenantId, order)
    return order
  } catch (err) {
    // Erros de negocio (senha duplicada etc.) sobem para o operador.
    if (!isOfflineError(err)) throw err
    // Offline: valida duplicidade contra o cache local e enfileira otimista.
    const cached = (await cacheGet(ordersKey(ctx.tenantId))) || []
    if (isTicketTaken(payload.ticket, cached)) {
      throw new Error(`A senha ${payload.ticket} já foi usada hoje.`)
    }
    const optimistic = optimisticOrder(payload)
    await cacheAppend(ctx.tenantId, optimistic)
    await outboxAdd({
      type: 'create',
      tenantId: ctx.tenantId,
      orderId: optimistic.id,
      payload,
    })
    return optimistic
  }
}

async function cloudStatusRaw(tenantId, id, opType) {
  const cfg = STATUS_OPS[opType]
  const patch = { status: cfg.status }
  patch[cfg.col] = new Date().toISOString()
  const { error } = await supabase.from('pedidos').update(patch).eq('id', id)
  if (error) throw error
  await cachePatchStatus(tenantId, id, cfg.status, cfg.localTs)
}

async function cloudUpdateStatus(ctx, id, opType) {
  const cfg = STATUS_OPS[opType]
  try {
    await cloudStatusRaw(ctx.tenantId, id, opType)
    return cloudFetch(ctx)
  } catch (err) {
    if (!isOfflineError(err)) throw err
    // Offline: aplica a mudanca no cache e enfileira para subir depois.
    await cachePatchStatus(ctx.tenantId, id, cfg.status, cfg.localTs)
    await outboxAdd({ type: opType, tenantId: ctx.tenantId, orderId: id })
    return (await cacheGet(ordersKey(ctx.tenantId))) || []
  }
}

// =====================================================================
// Replay da fila offline (registrado no syncQueue)
// =====================================================================

// Quantas senhas a mais tentamos quando a original ja foi usada. Cobre com
// folga uma colisao real (dois aparelhos offline na mesma faixa de senhas).
const MAX_REASSIGN_TRIES = 25

// Faixa reservada para senha reatribuida (#59). A senha e um papel fisico de
// bloco sequencial; se a reatribuicao pegasse o menor numero livre, ela cairia
// num papel que o caixa ainda vai entregar e a colisao voltaria mais tarde.
// Comecar em 900 mantem a senha reatribuida longe do bloco em uso — o operador
// avisa o cliente verbalmente ("sua senha agora e a 900").
const REASSIGN_BAND_START = 900

// Sobe um pedido da fila offline. Se a senha ja foi usada hoje por outro
// aparelho, NAO descarta a venda: pega uma senha livre e sobe com ela,
// devolvendo o de-para para o operador avisar o cliente.
//
// O cliente esta com a senha antiga na mao, entao quem resolve de verdade e
// gente — o sistema so garante que a venda nao se perca e que alguem seja
// avisado.
async function cloudCreateWithReassign(tenantId, payload) {
  try {
    const order = await cloudCreateRaw(tenantId, payload)
    return { order, reassignedFrom: null }
  } catch (err) {
    if (!isDuplicateTicket(err)) throw err
  }

  const original = normalizeTicket(payload.ticket)
  let candidate = null
  for (let i = 0; i < MAX_REASSIGN_TRIES; i += 1) {
    // Reconsulta a cada volta: outro aparelho pode ter ocupado a senha no meio.
    const current = await cloudFetchRaw(tenantId)
    candidate =
      candidate === null
        ? nextFreeTicket(current, { start: REASSIGN_BAND_START })
        : normalizeTicket(String(Number(candidate) + 1))
    try {
      const order = await cloudCreateRaw(tenantId, { ...payload, ticket: candidate })
      return { order, reassignedFrom: original }
    } catch (err) {
      if (!isDuplicateTicket(err)) throw err
      // colidiu de novo (corrida com outro aparelho): tenta a proxima
    }
  }
  throw new Error(
    'Nao foi possivel encontrar uma senha livre para o pedido da senha ' + original + '.',
  )
}

registerHandler('create', async (op) => {
  const { order, reassignedFrom } = await cloudCreateWithReassign(op.tenantId, op.payload)
  // troca o pedido otimista pelo confirmado e devolve o remapeamento de id
  // para as operacoes seguintes na fila (chamar/entregar/cancelar).
  await cacheReplace(op.tenantId, op.orderId, order)
  if (reassignedFrom && reassignedFrom !== order.ticket) {
    // Registro duravel: o operador PRECISA ver isso para avisar o cliente que
    // esta com a senha antiga em maos.
    await incidentAdd({
      type: 'ticket-reassigned',
      tenantId: op.tenantId,
      from: reassignedFrom,
      to: order.ticket,
      total: order.total,
    })
  }
  return { remap: { from: op.orderId, to: order.id } }
})

registerHandler('call', (op) => cloudStatusRaw(op.tenantId, op.orderId, 'call'))
registerHandler('deliver', (op) => cloudStatusRaw(op.tenantId, op.orderId, 'deliver'))
registerHandler('cancel', (op) => cloudStatusRaw(op.tenantId, op.orderId, 'cancel'))

// =====================================================================
// API UNICA (assincrona) — usada pelo App
// =====================================================================

export async function fetchOrders(ctx) {
  if (!isCloud(ctx)) return load().orders
  return cloudFetch(ctx)
}

// Cria o pedido apos pagamento confirmado e senha fisica informada.
// Lanca Error com mensagem amigavel quando alguma regra e violada.
export async function createOrder(ctx, payload) {
  const ticket = validatePayload(payload)
  const data = { ...payload, ticket }
  if (!isCloud(ctx)) return localCreate(data)
  return cloudCreate(ctx, data)
}

export async function callOrder(ctx, id) {
  if (!isCloud(ctx)) return localUpdateStatus(id, 'chamado', 'calledAt')
  return cloudUpdateStatus(ctx, id, 'call')
}

export async function deliverOrder(ctx, id) {
  if (!isCloud(ctx)) return localUpdateStatus(id, 'entregue', 'deliveredAt')
  return cloudUpdateStatus(ctx, id, 'deliver')
}

export async function cancelOrder(ctx, id) {
  if (!isCloud(ctx)) return localUpdateStatus(id, 'cancelado', 'cancelledAt')
  return cloudUpdateStatus(ctx, id, 'cancel')
}

// Limpa os pedidos (usado no fechamento de caixa e em demonstracao).
export async function clearOrders(ctx) {
  if (!isCloud(ctx)) {
    save({ orders: [] })
    return []
  }
  const { error } = await supabase.from('pedidos').delete().eq('tenant_id', ctx.tenantId)
  if (error) throw error
  await cacheSet(ordersKey(ctx.tenantId), [])
  return []
}
