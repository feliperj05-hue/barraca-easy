/**
 * Guarda do diario do piloto (issue #77, parte da #35).
 *
 * O piloto vai rodar numa barraca de parentes do Felipe, com fila na frente e
 * sinal oscilando. Se a anotacao se perder num reload, ou se o relatorio sair
 * sem os dados que interessam, o piloto vira "acho que travou uma hora dessas"
 * — que e exatamente o que este trabalho existe pra evitar.
 *
 * Roda sem navegador: simula o localStorage e importa os services de verdade.
 * Sem IndexedDB, o offlineDb degrada para vazio sozinho (por desenho), entao a
 * montagem do relatorio e exercitada no pior caso.
 *
 *   npm run diario-piloto
 */

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const { anotar, listarNotas, apagarNota, limparNotas, montarDiagnostico, TIPOS } =
  await import('../src/services/pilotLog.js')

const passos = []
function ok(nome, cond, extra) {
  passos.push({ nome, cond })
  console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome + (extra ? '  [' + extra + ']' : ''))
}

// 1. O caminho de dois toques: categoria e so. Texto e sempre opcional.
limparNotas()
const n1 = anotar('lento', '', { tela: 'Caixa' })
ok('Anota so com a categoria, sem digitar nada', listarNotas().length === 1)
ok('...guarda a hora sozinha', typeof n1.ts === 'string' && n1.ts.includes('T'))
ok('...guarda a tela onde a pessoa estava', n1.tela === 'Caixa')
ok('...guarda o estado da conexao sem perguntar', typeof n1.online === 'boolean')

// 2. Sobreviver a reload e a fechar o app e o ponto: sem isso, a anotacao feita
//    no aperto some justamente quando o aparelho engasga.
const cru = store.get('barracaEasyPilotLog')
store.clear()
store.set('barracaEasyPilotLog', cru) // e o que sobra depois de um F5
ok('Anotacao sobrevive a recarregar o app', listarNotas().length === 1)

// 3. Mais recente primeiro: quem abre a lista quer ver o que acabou de anotar.
anotar('senha', 'a senha 012 saiu repetida', { tela: 'Produção' })
const lista = listarNotas()
ok('Lista vem da mais recente pra mais antiga', lista[0].categoria === 'senha')
ok('Texto opcional e preservado', lista[0].texto === 'a senha 012 saiu repetida')

// 4. Toda categoria da tela precisa virar nome legivel no relatorio — senao o
//    arquivo chega aqui cheio de codigo interno.
const relatorioCategorias = await montarDiagnostico({})
ok(
  'Categorias aparecem por extenso, nao por codigo',
  TIPOS.every((c) => c.label.length > 3) &&
    relatorioCategorias.includes('Problema com a senha'),
)

// 5. O relatorio: e o unico jeito de tirar do tablet o que o app registrou.
const texto = await montarDiagnostico({
  tenantNome: 'Barraca da Tia',
  userEmail: 'dono@barraca.com',
  role: 'dono',
  modo: 'sincronizado',
  standalone: true,
})
const tem = (t) => texto.includes(t)
ok('Relatorio identifica a barraca', tem('Barraca da Tia'))
ok('Relatorio diz se estava instalado como app', tem('Instalado como app (tela cheia): sim'))
ok('Relatorio traz as anotacoes do operador', tem('a senha 012 saiu repetida'))
ok('Relatorio traz a secao de avisos do proprio app', tem('AVISOS QUE O APP REGISTROU SOZINHO'))
ok('Relatorio traz a fila que ainda nao subiu', tem('FILA AINDA NAO ENVIADA'))
ok('Relatorio e legivel por gente, nao JSON', !texto.trim().startsWith('{'))

// 6. Nada de credencial no arquivo: ele vai viajar por WhatsApp.
const suspeito = /access_token|refresh_token|password|senha do|Bearer |eyJ[A-Za-z0-9_-]{10}/i
ok('Relatorio nao carrega token nem senha de acesso', !suspeito.test(texto))

// 7. Sem IndexedDB (e o pior caso: navegador em modo restrito) nao pode
//    explodir — o relatorio ainda tem que sair com o que da.
ok('Relatorio sai mesmo sem IndexedDB', texto.includes('--- FIM ---'))

// 8. Remocao individual e limpeza, pra o dono nao mandar o diario do dia
//    anterior junto sem perceber.
apagarNota(lista[0].id)
ok('Remove uma anotacao especifica', listarNotas().length === 1)
limparNotas()
ok('Limpa tudo entre um dia e outro', listarNotas().length === 0)

// 9. Guarda de robustez: lixo no storage nao pode derrubar a tela de
//    Configuracoes bem no meio do piloto.
store.set('barracaEasyPilotLog', 'isso nao e json')
ok('Storage corrompido nao quebra a lista', Array.isArray(listarNotas()) && listarNotas().length === 0)

const falhas = passos.filter((p) => !p.cond)
console.log('\n' + (passos.length - falhas.length) + '/' + passos.length + ' passos OK')
if (falhas.length) process.exit(1)
