// Regra das teclas do teclado numerico proprio (#81).
//
// Mora fora do componente para poder ser testada sem navegador — esta VPS nao
// tem Chrome, e o campo de senha e caminho critico de balcao: e a ultima coisa
// do app que pode ir pra producao sem teste.

// Digito pressionado. Ignora o toque quando ja chegou no limite, em vez de
// truncar em silencio: o operador ve que nao entrou e corrige.
export function pressDigit(value, digit, maxLength = 6) {
  const atual = String(value || '')
  if (!/^[0-9]$/.test(String(digit))) return atual
  if (atual.length >= maxLength) return atual
  return atual + digit
}

// Apagar. Um digito por toque — apagar tudo de uma vez ja fez gente perder
// senha inteira sem perceber.
export function pressErase(value) {
  return String(value || '').slice(0, -1)
}
