const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(value) {
  return fmt.format(value || 0)
}
