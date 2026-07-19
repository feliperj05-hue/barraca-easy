const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '')
const configured = Boolean(baseUrl && publishableKey && !baseUrl.includes('<seu-ref>'))

function headers() {
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    'Content-Type': 'application/json',
  }
}

async function readJson(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error((payload && (payload.message || payload.error_description)) || 'Falha ao consultar o catálogo público.')
  }
  return response.json()
}

export async function listarPlanosPublicos() {
  if (!configured) return []
  const response = await fetch(`${baseUrl}/rest/v1/rpc/catalogo_publico_planos`, {
    method: 'POST',
    headers: headers(),
    body: '{}',
  })
  return readJson(response)
}

export async function listarNovidadesPublicas(limit = 3) {
  if (!configured) return []
  const params = new URLSearchParams({
    select: 'slug,categoria,titulo,resumo,publicado_em,destaque',
    publicado: 'eq.true',
    order: 'destaque.desc,publicado_em.desc',
    limit: String(limit),
  })
  const response = await fetch(`${baseUrl}/rest/v1/product_updates?${params}`, {
    headers: headers(),
  })
  return readJson(response)
}
