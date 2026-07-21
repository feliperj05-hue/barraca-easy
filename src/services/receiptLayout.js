// Layout do cupom (issue #63).
//
// Traduz um pedido REAL do app (o mesmo objeto que sai do orderService) para o
// documento de blocos que o escpos.js sabe imprimir ou pre-visualizar.
//
// Regra de ouro do cupom da barraca: a SENHA e a informacao mais importante do
// papel. Cliente le a senha de longe, com a mao cheia de coisa. Por isso ela
// vai em corpo ampliado e centralizada, antes de qualquer detalhe.

import { formatBRL } from '../utils/money.js'
import { AVISO_SEM_VALIDADE_FISCAL } from './fiscalNotice.js'
import { columnsFor } from './escpos.js'

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

// O aviso legal quebrado em linhas equilibradas para o papel.
//
// No papel de 80 mm (48 colunas) ele cabe numa linha so. No de 58 mm (32) nao
// cabe, e a quebra automatica encheria a primeira linha e deixaria "fiscal"
// sozinho embaixo — nao esta errado, mas fica feio e o aviso perde peso. Aqui
// a gente procura o espaco mais proximo do meio da frase e corta ali. Se nem
// assim couber (papel exotico), devolve a frase inteira e deixa o renderizador
// quebrar por palavra, que nunca corta palavra no meio.
function linhasDoAviso(paperWidth) {
  const largura = columnsFor(paperWidth)
  if (AVISO_SEM_VALIDADE_FISCAL.length <= largura) return [AVISO_SEM_VALIDADE_FISCAL]
  const palavras = AVISO_SEM_VALIDADE_FISCAL.split(' ')
  let melhor = null
  for (let i = 1; i < palavras.length; i += 1) {
    const cima = palavras.slice(0, i).join(' ')
    const baixo = palavras.slice(i).join(' ')
    if (cima.length > largura || baixo.length > largura) continue
    const desnivel = Math.abs(cima.length - baixo.length)
    if (!melhor || desnivel < melhor.desnivel) melhor = { cima, baixo, desnivel }
  }
  return melhor ? [melhor.cima, melhor.baixo] : [AVISO_SEM_VALIDADE_FISCAL]
}

// Compara dois textos ignorando caixa, acento e espaco sobrando. Serve so
// para nao imprimir a mesma frase duas vezes.
function mesmoTexto(a, b) {
  const limpa = (t) =>
    String(t || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  return limpa(a) === limpa(b)
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

  // Rodape do cupom. O aviso legal (#128) sai SEMPRE, com ou sem rodape
  // configurado pelo dono, e por ultimo: e a ultima coisa que o cliente le
  // antes de guardar o papel no bolso. Em size 1 ele respeita a largura do
  // papel (32 colunas no 58 mm, 48 no 80 mm) e o wrapText quebra por palavra,
  // entao nunca parte no meio de uma palavra.
  blocks.push({ type: 'divider' })
  // Dono que ja tinha colado o aviso no rodape nao faz o cupom repetir a frase.
  if (footer && !mesmoTexto(footer, AVISO_SEM_VALIDADE_FISCAL)) {
    blocks.push({ type: 'text', value: footer, align: 'center' })
  }
  for (const linha of linhasDoAviso(printer.paperWidth)) {
    blocks.push({ type: 'text', value: linha, align: 'center' })
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
