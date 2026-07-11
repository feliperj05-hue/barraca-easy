// Histórico de fechamentos de caixa (issue #24). Cada fechamento guarda um
// snapshot COMPLETO dos pedidos do período + um resumo pré-calculado. O
// relatório sempre é regerado a partir do snapshot, então zerar a produção
// nunca perde o relatório. Fechamentos passados nunca são alterados.
import { summarize } from './closingService.js'
import { findProduct } from './productService.js'

const STORAGE_KEY = 'barracaEasyClosings'

function load() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      return { version: 1, closings: Array.isArray(parsed.closings) ? parsed.closings : [] }
    } catch {
      // storage corrompido: recomeça vazio
    }
  }
  return { version: 1, closings: [] }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// Enriquece cada item com a categoria no ato do fechamento (lookup do produto
// atual; fallback estável). Assim o relatório não depende do produto continuar
// existindo/inalterado depois.
function enrichItems(order) {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      category: item.category || findProduct(item.id)?.category || 'Sem categoria',
    })),
  }
}

export function getClosings() {
  return load().closings
}

// Cria e persiste um fechamento a partir dos pedidos atuais.
export function createClosing(orders) {
  const snapshot = orders.map(enrichItems)
  const validTimes = snapshot
    .filter((o) => o.status !== 'cancelado')
    .map((o) => o.createdAt)
    .filter(Boolean)
    .sort()

  const record = {
    id: 'closing-' + Date.now(),
    closedAt: new Date().toISOString(),
    periodStart: validTimes[0] || null,
    orders: snapshot,
    summary: summarize(snapshot),
  }

  const state = load()
  state.closings.push(record)
  save(state)
  return record
}
