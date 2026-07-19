/**
 * Guarda do roteamento por URL (issue #107, item 1).
 *
 * O roteador entrou por baixo do App.jsx, que esta em producao e vai pro
 * piloto (#35). O que nao pode acontecer, em ordem de gravidade:
 *
 *   1. Um endereco valido levar para a tela errada (o operador abre o link do
 *      Caixa e cai no Fechamento no meio do movimento).
 *   2. Endereco desconhecido quebrar a tela em vez de cair no Caixa — quem
 *      digitou errado precisa vender, nao depurar URL.
 *   3. A raiz `/` deixar de abrir o app: e o start_url do PWA ja instalado
 *      no tablet da barraca.
 *   4. Ida e volta (tela -> path -> tela) perder informacao.
 *
 *   npm run rotas
 */

const { pathDaTela, telaDoPath, TELA_PADRAO } = await import('../src/services/router.js')

let falhas = 0
function ok(cond, msg) {
  if (cond) {
    console.log(`  ok   ${msg}`)
  } else {
    falhas += 1
    console.error(`  FALHA ${msg}`)
  }
}

console.log('\nCada tela tem endereco e volta nela mesma')
for (const tela of ['cashier', 'production', 'closing', 'settings', 'admin']) {
  const path = pathDaTela(tela)
  ok(path.startsWith('/'), `${tela} -> ${path}`)
  ok(telaDoPath(path) === tela, `${path} -> ${tela} (ida e volta)`)
}

console.log('\nEnderecos publicos sao os combinados')
ok(pathDaTela('cashier') === '/caixa', '/caixa')
ok(pathDaTela('production') === '/producao', '/producao')
ok(pathDaTela('closing') === '/fechamento', '/fechamento')
ok(pathDaTela('settings') === '/configuracoes', '/configuracoes')
ok(pathDaTela('admin') === '/clientes', '/clientes')

console.log('\nA raiz abre o app no Caixa (start_url do PWA instalado)')
ok(telaDoPath('/') === TELA_PADRAO, "'/' cai no Caixa")
ok(TELA_PADRAO === 'cashier', 'a tela padrao e o Caixa')

console.log('\nEndereco estranho nao quebra: cai no Caixa')
for (const ruim of ['/nao-existe', '', null, undefined, '/caixa/extra', '/CAIXA']) {
  ok(telaDoPath(ruim) === 'cashier', `${JSON.stringify(ruim)} -> cashier`)
}

console.log('\nBarra sobrando no fim nao muda a tela')
ok(telaDoPath('/producao/') === 'production', '/producao/ -> production')
ok(telaDoPath('/fechamento//') === 'closing', '/fechamento// -> closing')

console.log('\nTela desconhecida nao gera endereco invalido')
ok(pathDaTela('inventada') === '/caixa', 'tela inexistente -> /caixa')

console.log('')
if (falhas > 0) {
  console.error(`${falhas} falha(s) no roteamento.`)
  process.exit(1)
}
console.log('Roteamento ok.')
