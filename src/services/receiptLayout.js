// Layout do cupom (issue #63).
//
// Traduz um pedido REAL do app (o mesmo objeto que sai do orderService) para o
// documento de blocos que o escpos.js sabe imprimir ou pre-visualizar.
//
// Regra de ouro do cupom da barraca: a SENHA e a informacao mais importante do
// papel. Cliente le a senha de longe, com a mao cheia de coisa. Por isso ela
// vai em corpo ampliado e centralizada, antes de qualquer detalhe.

import { formatBRL } from '../utils/money.js'

function formatDateTime(value) {
  const d = value ? new Date(value) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return (
    pad(d.getDate()) +
    '/' +
    pad(d.getMonth() + 1) +
    '/' +
    d.getFullYear() +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
}

// Id curto so para rastrear o pedido no fechamento; nao substitui a senha.
function shortId(id) {
  const s = String(id || '')
  return s.length > 6 ? s.slice(-6).toUpperCase() : s.toUpperCase()
}

// Monta o documento do cupom. `printer` vem do printerService (config salva).
export function buildReceipt(order, printer = {}) {
  const blocks = []
  const header = (printer.header || '').trim()
  const footer = (printer.footer || '').trim()

  if (header) {
    blocks.push({ type: 'text', value: header, align: 'center', size: 2, bold: true })
    blocks.push({ type: 'text', value: '' })
  }

  // Bloco da senha — o motivo do cupom existir.
  blocks.push({ type: 'text', value: 'SENHA', align: 'center', bold: true })
  blocks.push({ type: 'text', value: String(order.ticket || '---'), align: 'center', size: 3 })
  blocks.push({ type: 'divider' })

  blocks.push({
    type: 'columns',
    left: formatDateTime(order.createdAt),
    right: shortId(order.id),
  })

  if (printer.showItems !== false && (order.items || []).length) {
    blocks.push({ type: 'divider' })
    for (const item of order.items) {
      blocks.push({
        type: 'columns',
        left: item.qty + 'x ' + item.name,
        right: formatBRL(item.subtotal != null ? item.subtotal : item.price * item.qty),
      })
    }
  }

  blocks.push({ type: 'divider' })
  blocks.push({ type: 'text', value: 'TOTAL ' + formatBRL(order.total || 0), align: 'right', size: 2, bold: true })
  if (order.payment) {
    blocks.push({ type: 'text', value: 'Pagamento: ' + order.payment, align: 'right' })
  }

  if (footer) {
    blocks.push({ type: 'divider' })
    blocks.push({ type: 'text', value: footer, align: 'center' })
  }

  blocks.push({ type: 'feed', lines: 2 })
  return blocks
}

// Pedido de mentira para o cupom de teste e para o preview nas Configuracoes.
// Serve justamente para validar o layout sem venda e sem impressora.
export function sampleOrder() {
  return {
    id: 'teste-000042',
    ticket: '027',
    createdAt: new Date().toISOString(),
    payment: 'Pix',
    total: 34.5,
    items: [
      { name: 'Açaí 500ml', qty: 2, price: 12, subtotal: 24 },
      { name: 'Água de coco', qty: 1, price: 6.5, subtotal: 6.5 },
      { name: 'Pastel de queijo', qty: 1, price: 4, subtotal: 4 },
    ],
  }
}
