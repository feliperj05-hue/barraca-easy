// Agrega o fechamento do dia. Considera apenas vendas confirmadas e não
// canceladas (pedidos cancelados ficam fora do faturamento).
export function summarize(orders) {
  const valid = orders.filter((o) => o.status !== 'cancelado')
  const delivered = valid.filter((o) => o.status === 'entregue')
  const pending = valid.filter((o) => o.status !== 'entregue')
  const cancelled = orders.filter((o) => o.status === 'cancelado')

  const total = valid.reduce((sum, o) => sum + o.total, 0)
  const average = valid.length ? total / valid.length : 0

  const paymentMap = {}
  valid.forEach((o) => {
    paymentMap[o.payment] = (paymentMap[o.payment] || 0) + o.total
  })

  const productMap = {}
  valid.forEach((o) => {
    o.items.forEach((item) => {
      if (!productMap[item.name]) productMap[item.name] = { qty: 0, total: 0 }
      productMap[item.name].qty += item.qty
      productMap[item.name].total += item.subtotal
    })
  })

  return {
    total,
    count: valid.length,
    delivered: delivered.length,
    pending: pending.length,
    cancelled: cancelled.length,
    average,
    byPayment: Object.entries(paymentMap).map(([method, value]) => ({ method, value })),
    byProduct: Object.entries(productMap)
      .map(([name, data]) => ({ name, qty: data.qty, total: data.total }))
      .sort((a, b) => b.qty - a.qty),
  }
}
