// Catálogo de produtos.
//
// Modelo (issue #22):
// - DEFAULT_PRODUCTS é o seed fixo no código: sempre presente numa instalação
//   limpa e nunca some. Ids estáveis.
// - O localStorage guarda APENAS a camada de customização (overrides de preço/
//   visibilidade dos defaults + itens criados pelo usuário). Nunca uma cópia
//   dos defaults. Assim, ao evoluir o seed no código, os novos defaults
//   aparecem automaticamente em qualquer instalação.
// - getMenu() mescla defaults + overrides + custom em runtime.
// - Defaults só podem ser ocultados/reprecificados; itens custom podem ser
//   editados e removidos.

const STORAGE_KEY = 'barracaEasyMenu'

export const DEFAULT_PRODUCTS = [
  { id: 'coxinha', name: 'Coxinha', category: 'Salgados', price: 8, emoji: '🥟' },
  { id: 'pastel', name: 'Pastel', category: 'Salgados', price: 10, emoji: '🥟' },
  { id: 'empada', name: 'Empada', category: 'Salgados', price: 9, emoji: '🥧' },
  { id: 'bolo-pote', name: 'Bolo de pote', category: 'Doces', price: 12, emoji: '🍰' },
  { id: 'brigadeiro', name: 'Brigadeiro', category: 'Doces', price: 4, emoji: '🍫' },
  { id: 'pudim', name: 'Pudim', category: 'Doces', price: 7, emoji: '🍮' },
  { id: 'bolo-fatia', name: 'Fatia de bolo', category: 'Bolos', price: 9, emoji: '🍰' },
  { id: 'bolo-caseiro', name: 'Bolo caseiro', category: 'Bolos', price: 18, emoji: '🎂' },
  { id: 'refrigerante', name: 'Refrigerante', category: 'Bebidas', price: 6, emoji: '🥤' },
  { id: 'suco', name: 'Suco', category: 'Bebidas', price: 7, emoji: '🧃' },
  { id: 'combo1', name: 'Combo salgado + refri', category: 'Combos', price: 14, emoji: '⚡' },
  { id: 'combo2', name: 'Combo doce + café', category: 'Combos', price: 10, emoji: '☕' },
]

function emptyState() {
  return { version: 1, overrides: {}, custom: [] }
}

function load() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      return {
        version: 1,
        overrides: parsed.overrides || {},
        custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      }
    } catch {
      // storage corrompido: recomeça do seed padrão
    }
  }
  return emptyState()
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function unique(list) {
  return [...new Set(list)]
}

// Aplica o override (price/hidden) de um default. custom: false marca origem.
function applyOverride(def, overrides) {
  const ov = overrides[def.id] || {}
  return {
    ...def,
    price: ov.price != null ? ov.price : def.price,
    hidden: !!ov.hidden,
    description: def.description || '',
    custom: false,
  }
}

function normalizeCustom(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    emoji: item.emoji,
    description: item.description || '',
    hidden: !!item.hidden,
    custom: true,
  }
}

// Lista completa (inclui ocultos) para a tela de administração do cardápio.
export function getMenu(state = load()) {
  const defaults = DEFAULT_PRODUCTS.map((d) => applyOverride(d, state.overrides))
  const customs = state.custom.map(normalizeCustom)
  return [...defaults, ...customs]
}

// Itens visíveis (não ocultos) para o Caixa.
export function getVisibleProducts() {
  return getMenu().filter((p) => !p.hidden)
}

// Categorias do Caixa: só das visíveis, com "Todos" na frente.
export function getCategories() {
  return ['Todos', ...unique(getVisibleProducts().map((p) => p.category))]
}

// Categorias canônicas (do seed) para o dropdown do formulário. Sem criação
// de categorias novas (decisão do produto).
export function getMenuCategories() {
  return unique(DEFAULT_PRODUCTS.map((p) => p.category))
}

export function findProduct(id) {
  return getMenu().find((p) => p.id === id)
}

// --- Mutações da camada de customização ---

// Override de um default (price e/ou hidden). Ignora ids que não são default.
export function setDefaultOverride(id, patch) {
  if (!DEFAULT_PRODUCTS.some((d) => d.id === id)) return getMenu()
  const state = load()
  const current = state.overrides[id] || {}
  state.overrides[id] = { ...current, ...patch }
  save(state)
  return getMenu()
}

export function addCustomItem({ name, category, price, emoji, description }) {
  const state = load()
  const item = normalizeCustom({
    id: 'custom-' + Date.now(),
    name,
    category,
    price,
    emoji,
    description,
    hidden: false,
  })
  state.custom.push(item)
  save(state)
  return getMenu()
}

export function updateCustomItem(id, patch) {
  const state = load()
  const item = state.custom.find((c) => c.id === id)
  if (!item) return getMenu()
  Object.assign(item, patch)
  save(state)
  return getMenu()
}

export function removeCustomItem(id) {
  const state = load()
  state.custom = state.custom.filter((c) => c.id !== id)
  save(state)
  return getMenu()
}

// Limpa todas as customizações: volta ao cardápio padrão do seed.
export function resetMenu() {
  save(emptyState())
  return getMenu()
}
