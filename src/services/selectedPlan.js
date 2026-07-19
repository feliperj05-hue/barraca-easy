const KEY = 'barracaEasyPlanoEscolhido'
const VALID = new Set(['plano_1', 'plano_2', 'plano_3', 'plano_4'])

export function rememberSelectedPlan(code) {
  if (!VALID.has(code) || typeof localStorage === 'undefined') return
  try { localStorage.setItem(KEY, code) } catch { /* armazenamento indisponível */ }
}

export function readSelectedPlan() {
  if (typeof localStorage === 'undefined') return null
  try {
    const code = localStorage.getItem(KEY)
    return VALID.has(code) ? code : null
  } catch {
    return null
  }
}

export function clearSelectedPlan() {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(KEY) } catch { /* nada a fazer */ }
}
