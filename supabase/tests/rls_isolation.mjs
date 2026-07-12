// Teste de isolamento de RLS (issue #28/#29) — valida que um tenant NAO
// enxerga nem escreve dados de outro. Usa a REST API do Supabase com tokens
// de usuarios REAIS (via publishable key), exercitando o RLS de verdade.
//
// Nao usa supabase-js (evita a dependencia de WebSocket do realtime no Node).
//
// PRE-REQUISITOS (o agente nao tem acesso ao painel Supabase):
//   - Confirm email esta LIGADO no projeto. Logo, os 2 usuarios de teste
//     precisam existir E estar confirmados. Crie-os em Auth > Users
//     (ou cadastre-os e confirme o e-mail).
//   - Passe as credenciais por variaveis de ambiente:
//       RLS_USER_A_EMAIL, RLS_USER_A_PASSWORD
//       RLS_USER_B_EMAIL, RLS_USER_B_PASSWORD
//   - URL/key sao lidas de .env.local (VITE_SUPABASE_URL /
//     VITE_SUPABASE_PUBLISHABLE_KEY) ou das mesmas variaveis no ambiente.
//
// Uso:
//   RLS_USER_A_EMAIL=a@x.com RLS_USER_A_PASSWORD=... \
//   RLS_USER_B_EMAIL=b@x.com RLS_USER_B_PASSWORD=... \
//   node supabase/tests/rls_isolation.mjs
import { readFileSync } from 'node:fs'

function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    return Object.fromEntries(
      txt
        .split('\n')
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
        }),
    )
  } catch {
    return {}
  }
}

const env = { ...loadEnvLocal(), ...process.env }
const URL_BASE = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY

if (!URL_BASE || !KEY) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.')
  process.exit(2)
}

const A = { email: env.RLS_USER_A_EMAIL, password: env.RLS_USER_A_PASSWORD }
const B = { email: env.RLS_USER_B_EMAIL, password: env.RLS_USER_B_PASSWORD }

if (!A.email || !A.password || !B.email || !B.password) {
  console.error(
    'Faltam credenciais de teste. Defina RLS_USER_A_EMAIL/PASSWORD e RLS_USER_B_EMAIL/PASSWORD\n' +
      '(2 usuarios reais e CONFIRMADOS, pois Confirm email esta ligado).',
  )
  process.exit(2)
}

async function signIn(user) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  })
  const body = await res.json()
  if (!res.ok) {
    if (/email not confirmed/i.test(body.error_description || body.msg || '')) {
      throw new Error(
        `Usuario ${user.email} nao confirmado. Confirme o e-mail em Auth > Users antes de rodar o teste.`,
      )
    }
    throw new Error(`Login falhou (${user.email}): ${body.error_description || JSON.stringify(body)}`)
  }
  return body.access_token
}

function api(token) {
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  return {
    async me() {
      const r = await fetch(`${URL_BASE}/auth/v1/user`, { headers })
      return (await r.json()).id
    },
    async insert(table, row) {
      const r = await fetch(`${URL_BASE}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(row),
      })
      const body = await r.json().catch(() => ({}))
      return { ok: r.ok, status: r.status, body }
    },
    async select(table, query) {
      const r = await fetch(`${URL_BASE}/rest/v1/${table}?${query}`, { headers })
      const body = await r.json().catch(() => ([]))
      return { ok: r.ok, status: r.status, body }
    },
  }
}

let pass = 0
let fail = 0
function check(name, cond, detail) {
  if (cond) {
    console.log(`  PASS  ${name}`)
    pass++
  } else {
    console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`)
    fail++
  }
}

async function run() {
  console.log('Autenticando 2 usuarios...')
  const [tokenA, tokenB] = [await signIn(A), await signIn(B)]
  const apiA = api(tokenA)
  const apiB = api(tokenB)
  const [uidA, uidB] = [await apiA.me(), await apiB.me()]

  console.log('Bootstrap: cada usuario cria o proprio tenant e se vincula como dono...')
  const tA = await apiA.insert('tenants', { nome: 'RLS Test A ' + Date.now() })
  const tB = await apiB.insert('tenants', { nome: 'RLS Test B ' + Date.now() })
  if (!tA.ok || !tB.ok) throw new Error('Falha ao criar tenants: ' + JSON.stringify({ tA, tB }))
  const tenantA = tA.body[0].id
  const tenantB = tB.body[0].id
  await apiA.insert('membros', { tenant_id: tenantA, user_id: uidA, papel: 'dono' })
  await apiB.insert('membros', { tenant_id: tenantB, user_id: uidB, papel: 'dono' })

  console.log('Inserindo dados no tenant A...')
  const prod = await apiA.insert('produtos', { tenant_id: tenantA, nome: 'Coxinha', preco: 8 })
  check('A consegue inserir produto no proprio tenant', prod.ok, JSON.stringify(prod.body))

  console.log('\nTeste de isolamento:')
  const bReadsA = await apiB.select('produtos', `tenant_id=eq.${tenantA}&select=id`)
  check(
    'B NAO le produtos do tenant A (retorno vazio)',
    bReadsA.ok && Array.isArray(bReadsA.body) && bReadsA.body.length === 0,
    JSON.stringify(bReadsA.body),
  )

  const bWritesA = await apiB.insert('produtos', {
    tenant_id: tenantA,
    nome: 'Intruso',
    preco: 1,
  })
  check(
    'B NAO escreve no tenant A (insert bloqueado pelo RLS)',
    !bWritesA.ok,
    'status ' + bWritesA.status,
  )

  const aReadsOwn = await apiA.select('produtos', `tenant_id=eq.${tenantA}&select=id`)
  check(
    'A le o proprio produto',
    aReadsOwn.ok && aReadsOwn.body.length >= 1,
    JSON.stringify(aReadsOwn.body),
  )

  console.log('\nRegra de senha unica por dia (#5):')
  const p1 = await apiA.insert('pedidos', {
    tenant_id: tenantA,
    senha: '027',
    forma_pagamento: 'dinheiro',
    total: 8,
  })
  check('A cria pedido senha 027', p1.ok, JSON.stringify(p1.body))
  const p2 = await apiA.insert('pedidos', {
    tenant_id: tenantA,
    senha: '027',
    forma_pagamento: 'pix',
    total: 8,
  })
  check('Senha 027 repetida no mesmo dia e bloqueada', !p2.ok, 'status ' + p2.status)

  console.log(`\nResultado: ${pass} PASS, ${fail} FAIL`)
  process.exit(fail === 0 ? 0 : 1)
}

run().catch((err) => {
  console.error('\nBLOQUEADO/ERRO:', err.message)
  process.exit(2)
})
