export function isSameDay(value, ref = new Date()) {
  const d = typeof value === 'string' ? new Date(value) : value
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  )
}

// Data/hora legível em pt-BR (ex: 11/07/2026 18:32). Usado no histórico e no
// relatório de fechamento.
export function formatDateTime(value) {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
