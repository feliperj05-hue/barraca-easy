export function isSameDay(value, ref = new Date()) {
  const d = typeof value === 'string' ? new Date(value) : value
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  )
}
