// Senha física prefixada com zeros (ex: "27" -> "027"). O sistema NÃO gera
// senha no modo padrão; apenas normaliza o número informado pelo caixa.
export function normalizeTicket(value) {
  return String(value || '')
    .trim()
    .replace(/\D/g, '')
    .padStart(3, '0')
}
