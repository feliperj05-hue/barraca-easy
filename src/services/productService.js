// Catalogo de produtos — backend-aware (issue #31, epic #26).
//
// Dois backends atras de uma API unica assincrona:
// - NUVEM (Supabase): quando ha credenciais + tenant. Cada produto e uma linha
//   em `produtos` (isolada por RLS). Os padrao sao semeados por tenant a partir
//   de DEFAULT_PRODUCTS; a coluna `seed` marca a origem (padrao vs custom).
// - LOCAL (localStorage): fallback quando nao ha nuvem/tenant. Mantem o modelo
//   original (issue #22): DEFAULT_PRODUCTS como seed fixo no codigo + uma camada
//   de customizacao (overrides de preco/visibilidade + itens custom).
//
// DEFAULT_PRODUCTS e o UNICO source dos padrao nos dois backends.

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

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

function unique(list) {
  return [...new Set(list)]
}

// Contexto de dados: { tenantId } liga a nuvem; null/sem tenant usa o local.
function isCloud(ctx) {
  return Boolean(isSupabaseConfigured && ctx && ctx.tenantId)
}

// Categorias canonicas (do seed) para o dropdown do formulario. Sem criacao
// de categorias novas (decisao do produto).
export function getMenuCategories() {
  return unique(DEFAULT_PRODUCTS.map((p) => p.category))
}

// =====================================================================
// Backend LOCAL (localStorage)
// =====================================================================

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
      // storage corrompido: recomeca do seed padrao
    }
  }
  return emptyState()
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

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

// Lista local completa (inclui ocultos). Mantida sincrona para o fallback e
// para o lookup de categoria do fechamento (findProduct).
export function getMenu(state = load()) {
  const defaults = DEFAULT_PRODUCTS.map((d) => applyOverride(d, state.overrides))
  const customs = state.custom.map(normalizeCustom)
  return [...defaults, ...customs]
}

// Lookup sincrono usado pelo fechamento como fallback de categoria. Opera no
// menu LOCAL; na nuvem os itens do pedido ja carregam a categoria (snapshot).
export function findProduct(id) {
  return getMenu().find((p) => p.id === id)
}

function localSetPrice(id, price) {
  if (!DEFAULT_PRODUCTS.some((d) => d.id === id)) return getMenu()
  const state = load()
  state.overrides[id] = { ...state.overrides[id], price }
  save(state)
  return getMenu()
}

function localToggleHidden(id, hidden) {
  const state = load()
  if (id.startsWith('custom-')) {
    const item = state.custom.find((c) => c.id === id)
    if (item) item.hidden = hidden
  } else if (DEFAULT_PRODUCTS.some((d) => d.id === id)) {
    state.overrides[id] = { ...state.overrides[id], hidden }
  }
  save(state)
  return getMenu()
}

function localAddItem({ name, category, price, emoji, description }) {
  const state = load()
  state.custom.push(
    normalizeCustom({
      id: 'custom-' + Date.now(),
      name,
      category,
      price,
      emoji,
      description,
      hidden: false,
    }),
  )
  save(state)
  return getMenu()
}

function localUpdateItem(id, patch) {
  const state = load()
  const item = state.custom.find((c) => c.id === id)
  if (!item) return getMenu()
  Object.assign(item, patch)
  save(state)
  return getMenu()
}

function localRemoveItem(id) {
  const state = load()
  state.custom = state.custom.filter((c) => c.id !== id)
  save(state)
  return getMenu()
}

function localReset() {
  save(emptyState())
  return getMenu()
}

// =====================================================================
// Backend NUVEM (Supabase)
// =====================================================================

const CLOUD_COLS = 'id, nome, categoria, preco, emoji, descricao, oculto, seed'

function fromRow(r) {
  return {
    id: r.id,
    name: r.nome,
    category: r.categoria,
    price: Number(r.preco),
    emoji: r.emoji || '',
    description: r.descricao || '',
    hidden: !!r.oculto,
    custom: !r.seed,
  }
}

// Mapeia um patch da UI (name/category/price/emoji/description/hidden) para as
// colunas de `produtos`.
function toRow(patch) {
  const row = {}
  if ('name' in patch) row.nome = patch.name
  if ('category' in patch) row.categoria = patch.category
  if ('price' in patch) row.preco = patch.price
  if ('emoji' in patch) row.emoji = patch.emoji
  if ('description' in patch) row.descricao = patch.description
  if ('hidden' in patch) row.oculto = patch.hidden
  return row
}

function seedRows(tenantId) {
  return DEFAULT_PRODUCTS.map((d) => ({
    tenant_id: tenantId,
    nome: d.name,
    categoria: d.category,
    preco: d.price,
    emoji: d.emoji,
    descricao: '',
    oculto: false,
    seed: true,
  }))
}

async function cloudFetch() {
  const { data, error } = await supabase
    .from('produtos')
    .select(CLOUD_COLS)
    .order('seed', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(fromRow)
}

// =====================================================================
// API UNICA (assincrona) — usada pelo App
// =====================================================================

// Semeia os padrao para um tenant que ainda nao tem produtos. Idempotente:
// so insere quando o cardapio da nuvem esta vazio. No-op no modo local.
export async function ensureSeeded(ctx) {
  if (!isCloud(ctx)) return
  const { count, error } = await supabase
    .from('produtos')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  if (count && count > 0) return
  const { error: e2 } = await supabase.from('produtos').insert(seedRows(ctx.tenantId))
  if (e2) throw e2
}

export async function fetchMenu(ctx) {
  if (!isCloud(ctx)) return getMenu()
  return cloudFetch()
}

export async function setPrice(ctx, id, price) {
  if (!isCloud(ctx)) return localSetPrice(id, price)
  const { error } = await supabase.from('produtos').update({ preco: price }).eq('id', id)
  if (error) throw error
  return cloudFetch()
}

export async function toggleHidden(ctx, id, hidden) {
  if (!isCloud(ctx)) return localToggleHidden(id, hidden)
  const { error } = await supabase.from('produtos').update({ oculto: hidden }).eq('id', id)
  if (error) throw error
  return cloudFetch()
}

export async function addItem(ctx, payload) {
  if (!isCloud(ctx)) return localAddItem(payload)
  const row = { ...toRow(payload), tenant_id: ctx.tenantId, oculto: false, seed: false }
  const { error } = await supabase.from('produtos').insert(row)
  if (error) throw error
  return cloudFetch()
}

export async function updateItem(ctx, id, patch) {
  if (!isCloud(ctx)) return localUpdateItem(id, patch)
  const { error } = await supabase.from('produtos').update(toRow(patch)).eq('id', id)
  if (error) throw error
  return cloudFetch()
}

export async function removeItem(ctx, id) {
  if (!isCloud(ctx)) return localRemoveItem(id)
  const { error } = await supabase.from('produtos').delete().eq('id', id)
  if (error) throw error
  return cloudFetch()
}

// Restaura o cardapio padrao: remove tudo do tenant e re-semeia os padrao.
export async function resetMenu(ctx) {
  if (!isCloud(ctx)) return localReset()
  const { error } = await supabase.from('produtos').delete().eq('tenant_id', ctx.tenantId)
  if (error) throw error
  const { error: e2 } = await supabase.from('produtos').insert(seedRows(ctx.tenantId))
  if (e2) throw e2
  return cloudFetch()
}
