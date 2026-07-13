// Histórico de fechamentos de caixa — backend-aware (issue #33, epic #26).
//
// Dois backends atrás de uma API única assíncrona, escolhidos pelo ctx:
// - NUVEM (Supabase): quando há credenciais + tenant. Cada fechamento é uma
//   linha em `fechamentos` (isolada por RLS `fechamentos_all`), guardando o
//   snapshot COMPLETO dos pedidos do período (jsonb) + um resumo pré-calculado
//   (jsonb). Histórico por tenant. É um insert direto — a tabela e a RLS já
//   vieram na migration da #28, então esta issue não precisa de nova DDL.
// - LOCAL (localStorage): fallback quando não há nuvem/tenant. Mantém o modelo
//   original da #24.
//
// Em ambos os casos o relatório .xlsx é regerado a partir do snapshot, então
// zerar a produção nunca perde o relatório. Fechamentos passados nunca são
// alterados (append-only nos dois backends).
import { summarize } from './closingService.js'
import { findProduct } from './productService.js'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const STORAGE_KEY = 'barracaEasyClosings'

function isCloud(ctx) {
  return Boolean(isSupabaseConfigured && ctx && ctx.tenantId)
}

// Enriquece cada item com a categoria no ato do fechamento. Na nuvem os itens
// já carregam a categoria (snapshot de `pedido_itens`); no modo local usamos o
// lookup do produto atual como fallback. Assim o relatório não depende do
// produto continuar existindo/inalterado depois.
function enrichItems(order) {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      category: item.category || findProduct(item.id)?.category || 'Sem categoria',
    })),
  }
}

// Monta o registro de fechamento (mesma forma nos dois backends) a partir dos
// pedidos atuais. Sem id/closedAt — quem persiste define esses campos.
function buildRecord(orders) {
  const snapshot = orders.map(enrichItems)
  const validTimes = snapshot
    .filter((o) => o.status !== 'cancelado')
    .map((o) => o.createdAt)
    .filter(Boolean)
    .sort()
  return {
    periodStart: validTimes[0] || null,
    orders: snapshot,
    summary: summarize(snapshot),
  }
}

// =====================================================================
// Backend LOCAL (localStorage)
// =====================================================================

function load() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      return { version: 1, closings: Array.isArray(parsed.closings) ? parsed.closings : [] }
    } catch {
      // storage corrompido: recomeça vazio
    }
  }
  return { version: 1, closings: [] }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// Lista local (síncrona). Mantida para o initializer e para leituras diretas
// no modo local; a API pública assíncrona (fetchClosings) delega para cá.
export function getClosings() {
  return load().closings
}

function localCreate(orders) {
  const base = buildRecord(orders)
  const record = {
    id: 'closing-' + Date.now(),
    closedAt: new Date().toISOString(),
    ...base,
  }
  const state = load()
  state.closings.push(record)
  save(state)
  return record
}

// =====================================================================
// Backend NUVEM (Supabase)
// =====================================================================

const CLOUD_COLS = 'id, closed_at, period_start, snapshot, summary'

function fromRow(r) {
  return {
    id: r.id,
    closedAt: r.closed_at,
    periodStart: r.period_start,
    orders: Array.isArray(r.snapshot) ? r.snapshot : [],
    summary: r.summary || {},
  }
}

async function cloudFetch() {
  const { data, error } = await supabase
    .from('fechamentos')
    .select(CLOUD_COLS)
    .order('closed_at', { ascending: true })
  if (error) throw error
  return (data || []).map(fromRow)
}

async function cloudCreate(ctx, orders) {
  const base = buildRecord(orders)
  const row = {
    tenant_id: ctx.tenantId,
    closed_at: new Date().toISOString(),
    period_start: base.periodStart,
    snapshot: base.orders,
    summary: base.summary,
  }
  const { data, error } = await supabase
    .from('fechamentos')
    .insert(row)
    .select(CLOUD_COLS)
    .single()
  if (error) throw error
  return fromRow(data)
}

// =====================================================================
// API ÚNICA (assíncrona) — usada pelo App
// =====================================================================

export async function fetchClosings(ctx) {
  if (!isCloud(ctx)) return getClosings()
  return cloudFetch()
}

// Cria e persiste um fechamento a partir dos pedidos atuais (nuvem ou local).
export async function createClosing(ctx, orders) {
  if (!isCloud(ctx)) return localCreate(orders)
  return cloudCreate(ctx, orders)
}
