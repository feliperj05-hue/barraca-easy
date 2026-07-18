/**
 * Guarda do portao de auth offline (issue #73).
 *
 * O bug que este script existe para nunca mais deixar voltar: o vinculo do
 * usuario (tenant + papel) so vinha da rede. Abrir o app sem sinal fazia o
 * `select` estourar, o vinculo virava `null` e o `Root.jsx` lia isso como
 * "esse usuario nao tem barraca" — jogando o operador na tela de Onboarding
 * com a barraca aberta, a fila cheia e as vendas do dia gravadas num cache
 * que ele nao conseguia mais endereçar (o cache e chaveado por tenantId).
 *
 * A regra em uma frase: **erro de transporte nao e resposta de negocio.**
 * So o servidor pode dizer "voce nao tem barraca". Sem sinal, o app usa o
 * ultimo vinculo conhecido e continua vendendo.
 *
 * Roda sem navegador e sem rede: simula o localStorage, importa o service de
 * verdade e reproduz a decisao do Root.jsx.
 *
 *   npm run portao-offline
 */

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const { cacheMembership, readCachedMembership, clearMembershipCache } = await import(
  '../src/services/authService.js'
)

// Espelha AuthContext.refreshMembership.
async function refresh(userId, loadMembership) {
  try {
    const m = await loadMembership()
    cacheMembership(userId, m)
    return m
  } catch {
    return readCachedMembership(userId)
  }
}

// Espelha a decisao de tela do Root.jsx.
function rota(sessao, vinculo) {
  if (!sessao) return 'Login'
  if (!vinculo) return 'Onboarding'
  return 'App'
}

const passos = []
function ok(nome, cond, extra) {
  passos.push({ nome, cond })
  console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome + (extra ? '  [' + extra + ']' : ''))
}

const VINCULO = { tenantId: 't-1', papel: 'dono', tenantNome: 'Barraca da Praia' }
const semRede = async () => {
  throw new TypeError('Failed to fetch')
}
const U = 'user-1'

// 1. Caminho feliz: online, com barraca.
ok('Online com barraca abre o app', rota(1, await refresh(U, async () => VINCULO)) === 'App')

// 2. O bug: boot sem sinal com sessao valida.
const offline = await refresh(U, semRede)
ok('Boot offline abre o Caixa (nao o Onboarding)', rota(1, offline) === 'App')
ok('Tenant preservado offline', offline && offline.tenantId === 't-1', 'cache de pedidos acessivel')

// 3. Quem realmente nao tem barraca continua vendo o Onboarding.
ok(
  'Sem barraca (servidor respondeu) vai pro Onboarding',
  rota(1, await refresh('user-2', async () => null)) === 'Onboarding',
)

// 4. Resposta real do servidor manda mais que o cache: vinculo removido
//    (operador tirado da barraca) nao pode ressuscitar offline.
await refresh(U, async () => null)
ok('Vinculo removido no servidor nao ressuscita offline', rota(1, await refresh(U, semRede)) === 'Onboarding')

// 5. Tablet que troca de mao nao vaza a barraca anterior.
await refresh(U, async () => VINCULO)
clearMembershipCache()
ok('signOut limpa o vinculo do aparelho', readCachedMembership(U) === null)

await refresh(U, async () => VINCULO)
ok('Um usuario nao herda o vinculo do outro', readCachedMembership('user-B') === null)

const falhas = passos.filter((p) => !p.cond)
console.log('\n' + (passos.length - falhas.length) + '/' + passos.length + ' passos OK')
if (falhas.length) process.exit(1)
