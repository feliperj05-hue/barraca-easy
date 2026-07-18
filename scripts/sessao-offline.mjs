/**
 * Guarda da sessao offline (issue #75).
 *
 * O risco: o access token do Supabase dura ~1h. Passada essa hora com o tablet
 * sem sinal, o supabase-js tenta renovar, o `fetch` estoura e o `getSession()`
 * devolve `session: null`. O portao lia isso como "nao esta logado" e jogava o
 * operador na tela de Login **sem internet para logar** — barraca parada no meio
 * do expediente, com a fila na frente.
 *
 * A regra, a mesma da #73: **falha de transporte nao e resposta de negocio.**
 * So o servidor pode dizer "sua sessao acabou". Sem sinal, o app segue com a
 * ultima credencial conhecida e as vendas vao pra fila.
 *
 * Este script tem duas partes:
 *
 *   1. SONDA — roda a lib de verdade (@supabase/supabase-js) com rede morta e
 *      sessao vencida, e imprime o que ela realmente faz. E a evidencia; se um
 *      upgrade da lib mudar o comportamento, aparece aqui.
 *   2. GUARDA — importa o `resolveSession` de verdade e reproduz a decisao de
 *      tela do Root.jsx nos cenarios que importam.
 *
 *   npm run sessao-offline
 */

// A lib instancia o cliente de realtime no construtor, que exige WebSocket
// nativo (Node 20 nao tem). Nada aqui usa realtime; o stub so deixa construir.
class WebSocketStub {
  addEventListener() {}
  removeEventListener() {}
  close() {}
  send() {}
}
globalThis.WebSocket = globalThis.WebSocket || WebSocketStub

const store = new Map()
const storage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
globalThis.localStorage = storage

const { createClient } = await import("@supabase/supabase-js")
const { resolveSession, readStoredSession, isTransportFailure } = await import(
  "../src/services/authService.js"
)

const passos = []
function ok(nome, cond, extra) {
  passos.push({ nome, cond })
  console.log((cond ? "OK   " : "FALHA") + " " + nome + (extra ? "  [" + extra + "]" : ""))
}

function jwt(exp) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
  return b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: "user-1", exp }) + ".assinatura"
}

// Sessao no formato que o supabase-js persiste no localStorage.
function sessao(expiresAt) {
  return {
    access_token: jwt(expiresAt),
    refresh_token: "refresh-abc",
    expires_at: expiresAt,
    expires_in: expiresAt - Math.floor(Date.now() / 1000),
    token_type: "bearer",
    user: { id: "user-1", email: "dono@barraca.com", aud: "authenticated" },
  }
}

const semRede = async () => {
  throw new TypeError("Failed to fetch")
}

// A lib loga cada tentativa de refresh que falha. Num teste que existe
// justamente para derrubar a rede, isso e so barulho por cima do resultado.
async function semBarulho(fn) {
  const original = console.error
  console.error = () => {}
  try {
    return await fn()
  } finally {
    console.error = original
  }
}

// Cliente novo por cenario: a lib guarda em memoria o resultado da ultima falha
// de refresh por 60s (cooldown), e isso contaminaria o cenario seguinte.
function clienteSemRede() {
  return createClient("https://ref123.supabase.co", "chave-publica", {
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage },
    global: { fetch: semRede },
  })
}

const agora = () => Math.floor(Date.now() / 1000)

// ---------------------------------------------------------------------------
// 1. SONDA: o que a lib faz de verdade
// ---------------------------------------------------------------------------
console.log("--- sonda: comportamento real do supabase-js com a rede morta\n")

async function sonda(nome, expiresAt) {
  const c = clienteSemRede()
  store.clear()
  store.set(c.storageKey, JSON.stringify(sessao(expiresAt)))
  const { data, error } = await semBarulho(() => c.auth.getSession())
  const preservada = store.has(c.storageKey)
  console.log(
    "     " +
      nome +
      "\n       getSession -> " +
      (data.session ? "sessao" : "null") +
      " | erro: " +
      (error ? error.name : "nenhum") +
      " | credencial no storage: " +
      (preservada ? "sim" : "NAO"),
  )
  return { data, error, preservada, client: c }
}

await sonda("token valido (2h de folga)", agora() + 7200)
const vencido = await sonda("TOKEN VENCIDO ha 1h  <- o cenario da #75", agora() - 3600)
console.log("")

ok(
  "Token vencido + rede morta faz o getSession devolver null",
  vencido.data.session === null,
  "e por isso que o portao precisa de rede de seguranca",
)
ok(
  "O erro e de transporte, nao de negocio",
  isTransportFailure(vencido.error),
  vencido.error ? vencido.error.name : "sem erro",
)
ok(
  "A lib PRESERVA a credencial no storage",
  vencido.preservada,
  "e o que torna a correcao possivel",
)

// ---------------------------------------------------------------------------
// 2. GUARDA: a decisao de tela
// ---------------------------------------------------------------------------
console.log("\n--- guarda: decisao do portao (Root.jsx)\n")

// Espelha o Root.jsx. O vinculo (#73) ja tem guarda propria em portao-offline.
function rota(sessaoResolvida, vinculo) {
  if (!sessaoResolvida) return "Login"
  if (!vinculo) return "Onboarding"
  return "App"
}

const VINCULO = { tenantId: "t-1", papel: "dono", tenantNome: "Barraca da Praia" }

// a) Expediente longo sem sinal: token venceu, rede morta, credencial no lugar.
{
  const c = clienteSemRede()
  store.clear()
  store.set(c.storageKey, JSON.stringify(sessao(agora() - 3600)))
  const r = await semBarulho(() => resolveSession(c))
  ok("Token vencido sem sinal continua no Caixa (nao vai pro Login)", rota(r.session, VINCULO) === "App")
  ok("...e fica marcado como degradado", r.stale === true, "escritas vao pra fila")
  ok("...com o usuario certo", r.session && r.session.user.id === "user-1")
}

// b) Aparelho zerado: ninguem logou aqui. Tem que pedir login mesmo offline.
{
  const c = clienteSemRede()
  store.clear()
  const r = await semBarulho(() => resolveSession(c))
  ok("Aparelho sem credencial nenhuma continua exigindo Login", rota(r.session, VINCULO) === "Login")
  ok("...e nao inventa modo degradado", r.stale === false)
}

// c) Sessao viva: caminho feliz, sem degradacao.
{
  const c = clienteSemRede()
  store.clear()
  store.set(c.storageKey, JSON.stringify(sessao(agora() + 7200)))
  const r = await semBarulho(() => resolveSession(c))
  ok("Token valido abre o Caixa normalmente", rota(r.session, VINCULO) === "App")
  ok("...sem marcar degradado", r.stale === false)
}

// d) Saida de verdade: o signOut da lib apaga a credencial do storage. O portao
//    nao pode ressuscitar sessao apagada — senao o tablet nunca troca de dono.
{
  const c = clienteSemRede()
  store.clear()
  store.set(c.storageKey, JSON.stringify(sessao(agora() - 3600)))
  storage.removeItem(c.storageKey) // e o que o _removeSession da lib faz
  const r = await semBarulho(() => resolveSession(c))
  ok("Credencial apagada (signOut) nao ressuscita offline", rota(r.session, VINCULO) === "Login")
}

// e) Lixo no storage nao vira credencial.
{
  const c = clienteSemRede()
  store.clear()
  store.set(c.storageKey, "{ isso nao e json")
  ok("Storage corrompido nao vira sessao", readStoredSession(c) === null)
  store.set(c.storageKey, JSON.stringify({ access_token: "x" })) // sem user/refresh
  ok("Sessao incompleta nao vira sessao", readStoredSession(c) === null)
}

// ---------------------------------------------------------------------------
// 3. A venda em si: erro de credencial nao pode estourar na tela do operador
// ---------------------------------------------------------------------------
console.log("\n--- guarda: venda com credencial vencida\n")

const { isDeferrableError, isOfflineError } = await import("../src/services/syncQueue.js")

// O 401 do PostgREST quando o JWT expirou. Chega como RESPOSTA, entao a
// heuristica de offline nao pega — mas continua sendo falha temporaria.
const jwtExpirado = { code: "PGRST301", message: "JWT expired" }
ok("401/JWT expirado nao e visto como queda de rede", isOfflineError(jwtExpirado) === false)
ok("...mas e adiavel: a venda vai pra fila, nao pro erro", isDeferrableError(jwtExpirado) === true)
ok("Senha duplicada continua sendo erro de negocio (sobe pro operador)", isDeferrableError({ code: "23505", message: "A senha 050 ja foi usada hoje." }) === false)
ok("Queda de rede continua adiavel", isDeferrableError(new TypeError("Failed to fetch")) === true)

const falhas = passos.filter((p) => !p.cond)
console.log("\n" + (passos.length - falhas.length) + "/" + passos.length + " passos OK")
if (falhas.length) process.exit(1)
