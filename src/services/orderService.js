import { normalizeTicket } from '../utils/tickets.js'
import { isSameDay } from '../utils/dates.js'

const STORAGE_KEY = 'barracaEasyManualTicketState'

function load() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      // storage corrompido: recomeça vazio
    }
  }
  return { orders: [] }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function getOrders() {
  return load().orders
}

// Fila da produção: pedidos do dia aguardando/chamados, ordenados por senha.
export function getOpenOrders(orders = getOrders()) {
  return orders
    .filter((o) => ['aguardando', 'chamado'].includes(o.status))
    .sort((a, b) => Number(a.ticket) - Number(b.ticket))
}

// Regra de senha duplicada (#5): bloqueia se já existir uma venda ativa (não
// cancelada) com a mesma senha no mesmo dia. Cancelada libera o número.
export function isTicketTaken(ticket, orders = getOrders()) {
  const t = normalizeTicket(ticket)
  const now = new Date()
  return orders.some(
    (o) => o.ticket === t && o.status !== 'cancelado' && isSameDay(o.createdAt, now),
  )
}

// Cria o pedido após pagamento confirmado e senha física informada.
// Lança Error com mensagem amigável quando alguma regra é violada.
export function createOrder({ items, payment, total, ticket }) {
  if (!items || !items.length) throw new Error('Adicione pelo menos um item.')
  if (!payment) throw new Error('Selecione a forma de pagamento.')
  if (!ticket || !String(ticket).trim()) {
    throw new Error('Informe a senha física liberada ao cliente.')
  }

  const normalized = normalizeTicket(ticket)
  // Senha sem dígitos válidos (ex: "abc" ou "0") normaliza para "000":
  // rejeita para não criar pedido com senha zerada (#17).
  if (!/[1-9]/.test(normalized)) {
    throw new Error('Informe uma senha numérica válida (ex: 27).')
  }

  const state = load()
  if (isTicketTaken(normalized, state.orders)) {
    throw new Error(`A senha ${normalized} já foi usada hoje.`)
  }

  const now = new Date().toISOString()
  const order = {
    id: 'order-' + Date.now(),
    ticket: normalized,
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

function updateStatus(id, status, timestampField) {
  const state = load()
  const order = state.orders.find((o) => o.id === id)
  if (!order) return state.orders
  order.status = status
  if (timestampField) order[timestampField] = new Date().toISOString()
  save(state)
  return state.orders
}

export function callOrder(id) {
  return updateStatus(id, 'chamado', 'calledAt')
}

export function deliverOrder(id) {
  return updateStatus(id, 'entregue', 'deliveredAt')
}

export function cancelOrder(id) {
  return updateStatus(id, 'cancelado', 'cancelledAt')
}

// Limpa os pedidos (conveniência para testes/demonstração).
export function clearOrders() {
  save({ orders: [] })
  return []
}
