/**
 * Verificador de contraste WCAG AA — issue #71.
 *
 * O app roda num tablet no balcao, muitas vezes com sol batendo. Contraste
 * aqui nao e detalhe de acessibilidade: e o operador conseguir ler a senha
 * com a fila esperando. Este script trava o build se alguem trocar uma cor
 * por uma que nao da o contraste minimo.
 *
 * Regra WCAG AA:
 *   - texto normal: 4.5:1
 *   - texto grande (>=18.66px negrito ou >=24px): 3:1
 *
 * Uso: npm run contraste
 */

const PALETA = {
  fundo: '#eae1d3',
  superficie: '#fffaf2',
  superficie2: '#f6efe3',
  texto: '#3c3835',
  textoSuave: '#5c5b53',
  textoInvertido: '#fffaf2',
  nav: '#3c3835',
  acao: '#f45f0d',
  acaoPressionado: '#d24f08',
  acaoTexto: '#9a4413',
  acaoTint: '#fbe6d6',
  institucional: '#ca6129',
  acentoSuave: '#e9a475',
  statusOk: '#488e42',
  statusOkTexto: '#3d5337',
  statusOkTint: '#e3efe1',
  atencaoTexto: '#7a5200',
  atencaoTint: '#fbeecd',
  perigo: '#c0392b',
  perigoTint: '#fbe9e7',
  cinza: '#8a8a81',
  branco: '#ffffff',
}

/** Pares realmente usados na UI. Se a cor nao esta aqui, nao e cor de texto. */
const PARES = [
  // --- Texto de corpo ---
  ['texto', 'fundo', 'normal', 'texto padrao no fundo areia'],
  ['texto', 'superficie', 'normal', 'texto padrao no cartao'],
  ['texto', 'superficie2', 'normal', 'texto em item rebaixado'],
  ['textoSuave', 'fundo', 'normal', 'texto secundario no fundo'],
  ['textoSuave', 'superficie', 'normal', 'texto secundario no cartao'],
  ['textoSuave', 'superficie2', 'normal', 'texto secundario em item'],

  // --- Navegacao (barra carvao) ---
  ['textoInvertido', 'nav', 'normal', 'aba inativa na barra'],
  ['nav', 'superficie', 'normal', 'aba ativa: carvao sobre papel'],

  // --- Acao primaria ---
  ['branco', 'acao', 'grande', 'CTA Confirmar pedido, texto grande negrito'],
  ['branco', 'acaoPressionado', 'grande', 'CTA pressionado'],
  ['acaoTexto', 'fundo', 'normal', 'laranja como texto no fundo'],
  ['acaoTexto', 'superficie', 'normal', 'laranja como texto no cartao'],
  ['acaoTexto', 'acaoTint', 'normal', 'selo laranja: senha, total do modal'],

  // --- Status positivo ---
  ['branco', 'statusOk', 'grande', 'botao Entregue / Pagamento confirmado'],
  ['statusOkTexto', 'statusOkTint', 'normal', 'selo Entregue / Online'],
  ['statusOkTexto', 'superficie', 'normal', 'texto de status no cartao'],
  ['statusOkTexto', 'fundo', 'normal', 'texto de status no fundo'],

  // --- Atencao / erro ---
  ['atencaoTexto', 'atencaoTint', 'normal', 'selo Chamado / aviso'],
  ['branco', 'perigo', 'normal', 'botao Cancelar'],
  ['perigo', 'superficie', 'normal', 'texto de erro no cartao'],
  ['perigo', 'perigoTint', 'normal', 'selo offline'],
]

function canal(v) {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminancia(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

function razao(a, b) {
  const la = luminancia(a)
  const lb = luminancia(b)
  const claro = la > lb ? la : lb
  const escuro = la > lb ? lb : la
  return (claro + 0.05) / (escuro + 0.05)
}

let falhas = 0
const linhas = []

for (const [frente, fundo, tamanho, descricao] of PARES) {
  const hexF = PALETA[frente]
  const hexB = PALETA[fundo]
  if (!hexF || !hexB) {
    console.error('Cor desconhecida no par: ' + frente + ' / ' + fundo)
    falhas++
    continue
  }
  const r = razao(hexF, hexB)
  const minimo = tamanho === 'grande' ? 3 : 4.5
  const passou = r >= minimo
  if (!passou) falhas++
  linhas.push(
    (passou ? 'OK   ' : 'FALHA') +
      ' ' +
      r.toFixed(2).padStart(5) +
      ':1 (min ' +
      minimo +
      ')  ' +
      frente +
      ' sobre ' +
      fundo +
      ' — ' +
      descricao,
  )
}

console.log('Contraste WCAG AA — Barraca Easy\n')
console.log(linhas.join('\n'))
console.log('')

if (falhas > 0) {
  console.error(falhas + ' par(es) reprovado(s). Ajuste a paleta antes de seguir.')
  process.exit(1)
}
console.log(PARES.length + ' pares aprovados.')
