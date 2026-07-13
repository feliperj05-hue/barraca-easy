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
// Os helpers de leitura (getOpenOrders, isTicketTaken) sao puros sobre um array
// de pedidos ja carregado — servem aos dois backends.

import { normalizeTicket } from '../utils/tickets.js'
import { isSameDay } from '../utils/dates.js'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const STORAGE_KEY = 'barracaEasyManualTicketState'

function isCloud(ctx) {
  return Boolean(isSupabaseConfigured && ctx && ctx.tenantId)
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

async function cloudFetch() {
  const { data, error } = await supabase
    .from('pedidos')
    .select(CLOUD_SELECT)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapOrder)
}

async function cloudCreate(ctx, { items, payment, total, ticket }) {
  const p_itens = items.map((it) => ({
    produto_id: it.id,
    nome: it.name,
    categoria: it.category,
    preco_unit: it.price,
    quantidade: it.qty,
  }))
  const { data, error } = await supabase.rpc('create_order', {
    p_tenant_id: ctx.tenantId,
    p_senha: ticket,
    p_forma_pagamento: payment,
    p_total: total,
    p_itens,
  })
  if (error) {
    if (error.code === '23505' || /usada hoje/i.test(error.message || '')) {
      throw new Error(`A senha ${ticket} já foi usada hoje.`)
    }
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  // A RPC retorna so o pedido; reanexamos os itens que acabamos de enviar
  // (evita um segundo roundtrip so para a tela de confirmacao).
  return mapOrder({ ...row, pedido_itens: p_itens })
}

async function cloudUpdateStatus(ctx, id, status, tsField) {
  const patch = { status }
  patch[tsField] = new Date().toISOString()
  const { error } = await supabase.from('pedidos').update(patch).eq('id', id)
  if (error) throw error
  return cloudFetch()
}

// =====================================================================
// API UNICA (assincrona) — usada pelo App
// =====================================================================

export async function fetchOrders(ctx) {
  if (!isCloud(ctx)) return load().orders
  return cloudFetch()
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
  return cloudUpdateStatus(ctx, id, 'chamado', 'called_at')
}

export async function deliverOrder(ctx, id) {
  if (!isCloud(ctx)) return localUpdateStatus(id, 'entregue', 'deliveredAt')
  return cloudUpdateStatus(ctx, id, 'entregue', 'delivered_at')
}

export async function cancelOrder(ctx, id) {
  if (!isCloud(ctx)) return localUpdateStatus(id, 'cancelado', 'cancelledAt')
  return cloudUpdateStatus(ctx, id, 'cancelado', 'cancelled_at')
}

// Limpa os pedidos (usado no fechamento de caixa e em demonstracao).
export async function clearOrders(ctx) {
  if (!isCloud(ctx)) {
    save({ orders: [] })
    return []
  }
  const { error } = await supabase.from('pedidos').delete().eq('tenant_id', ctx.tenantId)
  if (error) throw error
  return []
}
