// Geração do relatório .xlsx de um fechamento. A lib SheetJS (xlsx) é carregada
// por import dinâmico, então o Vite a coloca num chunk separado, baixado só
// quando o usuário clica em "Baixar relatório" (bundle inicial segue leve).
import { formatDateTime } from '../utils/dates.js'

const STATUS_LABELS = {
  aguardando: 'Aguardando',
  chamado: 'Chamado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

function fileName(closing) {
  const stamp = closing.closedAt.slice(0, 19).replace(/[:T]/g, '-')
  return `fechamento-${stamp}.xlsx`
}

export async function downloadClosingReport(closing) {
  const XLSX = await import('xlsx')

  // Aba 1 — Lançamentos: uma linha por item, cancelados fora.
  const rows = []
  closing.orders
    .filter((o) => o.status !== 'cancelado')
    .forEach((order) => {
      order.items.forEach((item) => {
        rows.push({
          'Data/Hora': formatDateTime(order.createdAt),
          Senha: order.ticket,
          Produto: item.name,
          Categoria: item.category || 'Sem categoria',
          Qtd: item.qty,
          'Preço unit.': item.price,
          Subtotal: item.subtotal,
          Pagamento: order.payment,
          Status: STATUS_LABELS[order.status] || order.status,
        })
      })
    })

  const headers = [
    'Data/Hora',
    'Senha',
    'Produto',
    'Categoria',
    'Qtd',
    'Preço unit.',
    'Subtotal',
    'Pagamento',
    'Status',
  ]
  const ws1 = XLSX.utils.json_to_sheet(rows, { header: headers })
  ws1['!cols'] = [
    { wch: 18 },
    { wch: 8 },
    { wch: 22 },
    { wch: 14 },
    { wch: 6 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ]

  // Aba 2 — Consolidado: pagamento, categoria e produto.
  const s = closing.summary
  const aoa = []
  aoa.push(['Consolidado do fechamento'])
  aoa.push(['Fechado em', formatDateTime(closing.closedAt)])
  aoa.push(['Total do fechamento', s.total])
  aoa.push(['Vendas confirmadas', s.count])
  aoa.push([])
  aoa.push(['Por forma de pagamento'])
  aoa.push(['Forma', 'Total'])
  s.byPayment.forEach((r) => aoa.push([r.method, r.value]))
  aoa.push([])
  aoa.push(['Por categoria'])
  aoa.push(['Categoria', 'Total'])
  s.byCategory.forEach((r) => aoa.push([r.category, r.value]))
  aoa.push([])
  aoa.push(['Por produto'])
  aoa.push(['Produto', 'Qtd', 'Total'])
  s.byProduct.forEach((r) => aoa.push([r.name, r.qty, r.total]))

  const ws2 = XLSX.utils.aoa_to_sheet(aoa)
  ws2['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Lançamentos')
  XLSX.utils.book_append_sheet(wb, ws2, 'Consolidado')
  XLSX.writeFile(wb, fileName(closing))
}
