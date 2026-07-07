// Catálogo de produtos. Fixo nesta fase (editável via Admin em fase futura).
const PRODUCTS = [
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

export function getProducts() {
  return PRODUCTS
}

export function getCategories() {
  return ['Todos', ...new Set(PRODUCTS.map((p) => p.category))]
}

export function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id)
}
