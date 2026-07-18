/**
 * Guarda do teclado numerico proprio (issue #81).
 *
 * Contexto: o Felipe testou no tablet e o teclado do Android come metade da
 * tela — o total do pedido sai da vista bem na hora de cobrar. Trocamos por um
 * teclado do proprio app.
 *
 * O risco de fazer isso: teclado proprio malfeito e PIOR que o nativo, porque
 * o nativo pelo menos e previsivel. Entao a regra de cada tecla mora fora do
 * componente e e testada aqui, junto com a leitura do JSX pra garantir o que
 * nao da pra testar sem navegador.
 *
 *   npm run teclado
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const { pressDigit, pressErase } = await import('../src/utils/keypad.js')

const passos = []
function ok(nome, cond, extra) {
  passos.push({ nome, cond })
  console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome + (extra ? '  [' + extra + ']' : ''))
}

// --- 1. A regra das teclas
console.log('--- o que cada tecla faz\n')

ok('Digitar do zero', pressDigit('', '7') === '7')
ok('Vai concatenando', pressDigit(pressDigit('', '0'), '2') === '02')
ok('Zero a esquerda e preservado', pressDigit('0', '5') === '05', 'senha "027" precisa disso')
ok('Apagar tira um digito so', pressErase('027') === '02')
ok('Apagar em campo vazio nao quebra', pressErase('') === '')
ok('Apagar ate esvaziar', pressErase(pressErase('12')) === '')

// Limite: para de aceitar em vez de truncar calado. O operador ve que nao
// entrou e corrige — truncar geraria uma senha diferente da que ele leu.
let v = ''
for (const d of '1234567890') v = pressDigit(v, d, 6)
ok('Respeita o limite de digitos', v === '123456', 'nao trunca calado, so para')
ok('Depois do limite, mais toque nao muda nada', pressDigit('123456', '9', 6) === '123456')

// Robustez: so digito entra. Um dia alguem liga teclado USB no tablet.
ok('Letra nao entra', pressDigit('02', 'a') === '02')
ok('Sinal nao entra', pressDigit('02', '-') === '02')
ok('Undefined nao vira "undefined"', pressDigit(undefined, '3') === '3')

// --- 2. O que so da pra garantir lendo o componente
console.log('\n--- garantias que dependem do JSX\n')

// Sem os comentarios: eles falam SOBRE `<input>` justamente pra explicar por
// que nao ha nenhum, e uma busca crua acharia a explicacao em vez do codigo.
function semComentarios(texto) {
  return texto
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n')
}

const teclado = semComentarios(
  readFileSync(join(raiz, 'src/components/NumericKeypad.jsx'), 'utf8'),
)
const modal = semComentarios(readFileSync(join(raiz, 'src/components/PaymentModal.jsx'), 'utf8'))

// O motivo de tudo: sem campo focavel, o Android nao tem o que focar, e o
// teclado do sistema simplesmente nao aparece. `readonly` dependeria do
// fabricante e da versao do IME; ausencia de input nao depende de ninguem.
ok(
  'O modal nao tem mais <input> de senha (senao o Android abre o teclado dele)',
  !/<input/.test(modal),
  'motivo da queixa do Felipe',
)
ok('O valor digitado sai num <output> com aria-live', /<output/.test(modal) && /aria-live/.test(modal))
ok('O teclado tem rotulo pra leitor de tela', /aria-label="Teclado num/.test(teclado))
ok('A tecla de apagar tem rotulo proprio', /aria-label="Apagar/.test(teclado))

// Dentro de um modal, botao sem type vira submit e manda a venda antes da hora.
const botoes = teclado.match(/<button/g) || []
const comTipo = teclado.match(/type="button"/g) || []
ok(
  'Todo botao do teclado declara type="button"',
  botoes.length > 0 && comTipo.length >= botoes.length,
  botoes.length + ' botoes',
)

// Teclado fisico continua valendo: tem gente que pluga USB no tablet, e tirar
// isso seria regressao silenciosa de acessibilidade.
ok('Teclado fisico continua funcionando', /keydown/.test(teclado) && /Backspace/.test(teclado))
ok('Enter confirma', /'Enter'/.test(teclado))

// Alvo de toque: 64px e o que separa "da pra usar com pressa" de "erra tecla".
const css = readFileSync(join(raiz, 'src/styles/app.css'), 'utf8')
const bloco = css.slice(css.indexOf('.keypad-key {'))
const min = /min-height:\s*(\d+)px/.exec(bloco)
ok('Tecla com pelo menos 56px de altura', min && Number(min[1]) >= 56, min ? min[1] + 'px' : 'nao achei')
ok('Foco visivel no teclado (navegacao sem toque)', /\.keypad-key:focus-visible/.test(css))
ok('Sem atraso de duplo toque', /touch-action:\s*manipulation/.test(css))

const falhas = passos.filter((p) => !p.cond)
console.log('\n' + (passos.length - falhas.length) + '/' + passos.length + ' passos OK')
if (falhas.length) process.exit(1)
