// Teste de RLS por PAPEL (issue #99) — valida que um OPERADOR nao consegue
// fazer no banco o que a tela nao lhe oferece: editar/apagar cardapio, apagar
// pedido e ler/escrever fechamento.
//
// Complementa `rls_isolation.mjs`, que cobre o isolamento ENTRE barracas.
// Aqui o furo testado e DENTRO da mesma barraca.
//
// PRE-REQUISITOS (o agente nao tem acesso ao painel Supabase):
//   - 2 usuarios reais e CONFIRMADOS (Confirm email esta ligado no projeto):
//       RLS_DONO_EMAIL / RLS_DONO_PASSWORD
//       RLS_OPERADOR_EMAIL / RLS_OPERADOR_PASSWORD
//   - O tenant de teste precisa caber 2 usuarios. Tenant novo nasce no
//     plano_1 (1 usuario), entao o vinculo do operador seria barrado pelo
//     limite do plano — nao pela RLS de papel. Duas saidas:
//       a) exportar RLS_TENANT_ID de um tenant ja existente em plano >= 2 no
//          qual RLS_DONO_EMAIL seja dono; ou
//       b) subir o plano do tenant de teste pelo painel /admin.
//     Sem isso o teste PARA com instrucao, em vez de dar falso verde.
//   - URL/key vem de .env.local (VITE_SUPABASE_URL /
//     VITE_SUPABASE_PUBLISHABLE_KEY) ou do ambiente.
//
// Uso:
//   RLS_DONO_EMAIL=... RLS_DONO_PASSWORD=... \
//   RLS_OPERADOR_EMAIL=... RLS_OPERADOR_PASSWORD=... \
//   node supabase/tests/rls_papeis.mjs
import { readFileSync } from "node:fs"

function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    return Object.fromEntries(
      txt
        .split("\n")
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=")
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
  console.error("Faltam VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.")
  process.exit(2)
}

const DONO = { email: env.RLS_DONO_EMAIL, password: env.RLS_DONO_PASSWORD }
const OPER = { email: env.RLS_OPERADOR_EMAIL, password: env.RLS_OPERADOR_PASSWORD }

if (!DONO.email || !DONO.password || !OPER.email || !OPER.password) {
  console.error(
    "Faltam credenciais. Defina RLS_DONO_EMAIL/PASSWORD e RLS_OPERADOR_EMAIL/PASSWORD\n" +
      "(2 usuarios reais e CONFIRMADOS).",
  )
  process.exit(2)
}

async function signIn(user) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(
      `Login falhou (${user.email}): ${body.error_description || JSON.stringify(body)}`,
    )
  }
  return body.access_token
}

function api(token) {
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
  return {
    async me() {
      const r = await fetch(`${URL_BASE}/auth/v1/user`, { headers })
      return (await r.json()).id
    },
    async insert(table, row) {
      const r = await fetch(`${URL_BASE}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(row),
      })
      return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }
    },
    async select(table, query) {
      const r = await fetch(`${URL_BASE}/rest/v1/${table}?${query}`, { headers })
      return { ok: r.ok, status: r.status, body: await r.json().catch(() => []) }
    },
    async patch(table, query, row) {
      const r = await fetch(`${URL_BASE}/rest/v1/${table}?${query}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(row),
      })
      return { ok: r.ok, status: r.status, body: await r.json().catch(() => []) }
    },
    async remove(table, query) {
      const r = await fetch(`${URL_BASE}/rest/v1/${table}?${query}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=representation" },
      })
      return { ok: r.ok, status: r.status, body: await r.json().catch(() => []) }
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
    console.log(`  FAIL  ${name}${detail ? " -> " + detail : ""}`)
    fail++
  }
}

// PostgREST devolve 0 linha afetada quando a RLS filtra o UPDATE/DELETE (nao
// da erro). Entao "bloqueado" = erro OU nenhuma linha voltou.
function bloqueado(res) {
  return !res.ok || (Array.isArray(res.body) && res.body.length === 0)
}

async function run() {
  console.log("Autenticando dono e operador...")
  const apiD = api(await signIn(DONO))
  const apiO = api(await signIn(OPER))
  const uidO = await apiO.me()
  const uidD = await apiD.me()

  let tenantId = env.RLS_TENANT_ID
  if (!tenantId) {
    const t = await apiD.insert("tenants", { nome: "RLS Papeis " + Date.now() })
    if (!t.ok) throw new Error("Falha ao criar tenant: " + JSON.stringify(t.body))
    tenantId = t.body[0].id
    await apiD.insert("membros", { tenant_id: tenantId, user_id: uidD, papel: "dono" })
  }

  const vinculo = await apiD.insert("membros", {
    tenant_id: tenantId,
    user_id: uidO,
    papel: "operador",
  })
  const jaEraMembro = /duplicate key/i.test(JSON.stringify(vinculo.body || {}))
  if (!vinculo.ok && !jaEraMembro) {
    console.error(
      "\nNao foi possivel vincular o operador ao tenant:\n  " +
        JSON.stringify(vinculo.body) +
        "\n\nProvavel limite de usuarios do plano (tenant novo nasce no plano_1 = 1 usuario).\n" +
        "Suba o plano do tenant no painel /admin ou exporte RLS_TENANT_ID de um tenant\n" +
        "em plano >= 2 usuarios. Teste ABORTADO para nao dar falso verde.",
    )
    process.exit(2)
  }

  console.log("\nPreparando dados como dono...")
  const prod = await apiD.insert("produtos", {
    tenant_id: tenantId,
    nome: "Coxinha " + Date.now(),
    preco: 8,
  })
  check("dono cria produto", prod.ok, JSON.stringify(prod.body))
  const prodId = prod.ok ? prod.body[0].id : null

  const ped = await apiD.insert("pedidos", {
    tenant_id: tenantId,
    senha: "T" + Date.now().toString().slice(-6),
    forma_pagamento: "dinheiro",
    total: 8,
  })
  check("dono cria pedido", ped.ok, JSON.stringify(ped.body))
  const pedId = ped.ok ? ped.body[0].id : null

  console.log("\nO que o operador PRECISA conseguir fazer:")
  const leProd = await apiO.select("produtos", `tenant_id=eq.${tenantId}&select=id`)
  check("operador LE o cardapio", leProd.ok && leProd.body.length >= 1, JSON.stringify(leProd.body))

  const criaPedido = await apiO.insert("pedidos", {
    tenant_id: tenantId,
    senha: "O" + Date.now().toString().slice(-6),
    forma_pagamento: "dinheiro",
    total: 8,
  })
  check("operador LANCA pedido", criaPedido.ok, JSON.stringify(criaPedido.body))

  if (pedId) {
    const cancela = await apiO.patch("pedidos", `id=eq.${pedId}`, { status: "cancelado" })
    check("operador CANCELA pedido (update de status)", cancela.ok && cancela.body.length === 1)
  }

  console.log("\nO que o operador NAO pode fazer (o furo do #99):")
  if (prodId) {
    const mudaPreco = await apiO.patch("produtos", `id=eq.${prodId}`, { preco: 1 })
    check("operador NAO muda preco", bloqueado(mudaPreco), JSON.stringify(mudaPreco.body))

    const apagaProd = await apiO.remove("produtos", `id=eq.${prodId}`)
    check("operador NAO apaga produto", bloqueado(apagaProd), JSON.stringify(apagaProd.body))
  }

  const criaProd = await apiO.insert("produtos", {
    tenant_id: tenantId,
    nome: "Intruso",
    preco: 1,
  })
  check("operador NAO cria produto", !criaProd.ok, "status " + criaProd.status)

  if (pedId) {
    const apagaPed = await apiO.remove("pedidos", `id=eq.${pedId}`)
    check("operador NAO apaga pedido", bloqueado(apagaPed), JSON.stringify(apagaPed.body))
  }

  const fech = await apiD.insert("fechamentos", {
    tenant_id: tenantId,
    data: new Date().toISOString().slice(0, 10),
    total: 8,
  })
  if (fech.ok) {
    const leFech = await apiO.select("fechamentos", `tenant_id=eq.${tenantId}&select=id`)
    check(
      "operador NAO le fechamento",
      leFech.ok && Array.isArray(leFech.body) && leFech.body.length === 0,
      JSON.stringify(leFech.body),
    )
  } else {
    console.log("  SKIP  fechamento nao criado pelo dono -> " + JSON.stringify(fech.body))
  }

  const criaFech = await apiO.insert("fechamentos", {
    tenant_id: tenantId,
    data: new Date().toISOString().slice(0, 10),
    total: 999,
  })
  check("operador NAO cria fechamento", !criaFech.ok, "status " + criaFech.status)

  console.log(`\n${pass} passaram, ${fail} falharam.`)
  process.exit(fail === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error("Erro no teste:", e.message)
  process.exit(2)
})
