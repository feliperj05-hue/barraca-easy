// Minimizacao e retencao de dado pessoal (issue #87, LGPD).
//
// A ideia que guia este arquivo: **o melhor jeito de proteger um dado e nao
// ter o dado.** Antes daqui, o app mandava a string inteira de user-agent junto
// com cada recado e cada relatorio de piloto. Aquilo identifica aparelho com
// uma precisao que eu nunca precisei pra achar bug — pra investigar basta saber
// que era um Android com Chrome. O resto era coleta sem proposito, e coleta sem
// proposito e exatamente o que a LGPD chama de excesso.
//
// O que ficou de fora e por que:
// - E-mail do operador CONTINUA sendo guardado. Nao e excesso: e como eu
//   respondo a pessoa que reclamou e como acho a conta dela pra dar suporte.
//   Tem proposito declarado, prazo definido e a pessoa pode pedir exclusao.
// - Venda (pedido, item, fechamento) nao aparece aqui porque nao tem dado
//   pessoal nenhum: senha de papel, forma de pagamento, total e horario. O que
//   manda no prazo dela e guarda fiscal, nao LGPD.

// Prazo do que fica NO APARELHO. O tablet da barraca e ferramenta de trabalho,
// nao arquivo morto: passados 3 meses, o recado que importava ja subiu pra
// nuvem e ja virou correcao. Segurar mais so aumenta o estrago se o aparelho
// for perdido ou roubado.
export const DIAS_RETENCAO_LOCAL = 90

// Resumo do aparelho a partir do user-agent.
//
// Entra:  "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 ...
//          Chrome/120.0.0.0 Mobile Safari/537.36"
// Sai:    "Android 13 · Chrome"
//
// Some o modelo exato do aparelho, a versao detalhada do navegador e o resto
// da string — que juntos dao pra reconhecer um aparelho especifico dentro de um
// grupo pequeno. Fica o que responde a pergunta que eu de fato faco quando um
// bug aparece: "que sistema e que navegador?".
export function resumoAparelho(ua) {
  const s = String(ua || '')
  if (!s) return 'nao informado'

  let sistema = 'sistema desconhecido'
  const android = s.match(/Android (\d+)/)
  const ios = s.match(/OS (\d+)[_.]/)
  if (android) sistema = 'Android ' + android[1]
  else if (ios && /iPhone|iPad/.test(s)) sistema = 'iOS ' + ios[1]
  else if (/Windows NT/.test(s)) sistema = 'Windows'
  else if (/Mac OS X/.test(s)) sistema = 'macOS'
  else if (/Linux/.test(s)) sistema = 'Linux'

  // Ordem importa: quase todo navegador mente dizendo que tambem e Chrome e
  // Safari. Do mais especifico pro mais generico.
  let navegador = 'navegador desconhecido'
  if (/Edg\//.test(s)) navegador = 'Edge'
  else if (/OPR\/|Opera/.test(s)) navegador = 'Opera'
  else if (/SamsungBrowser/.test(s)) navegador = 'Samsung Internet'
  else if (/Firefox\//.test(s)) navegador = 'Firefox'
  else if (/Chrome\//.test(s)) navegador = 'Chrome'
  else if (/Safari\//.test(s)) navegador = 'Safari'

  return sistema + ' · ' + navegador
}

// So a origem, sem caminho nem parametro. `location.href` podia levar junto
// qualquer coisa que um dia venha na URL; a origem responde a unica pergunta
// util aqui — o recado veio de producao ou de um canal de teste?
export function origemDoApp(href) {
  try {
    return new URL(String(href)).origin
  } catch {
    return null
  }
}

export function limiteRetencaoLocal(agora) {
  const base = agora ? new Date(agora) : new Date()
  return new Date(base.getTime() - DIAS_RETENCAO_LOCAL * 24 * 60 * 60 * 1000)
}

// Decide o que fica. Recebe a lista e devolve a lista filtrada — sem tocar em
// storage, pra poder testar isso sem navegador.
//
// Nota com data ilegivel FICA. Apagar por causa de campo quebrado seria perder
// recado de gente por bug meu; quem some e so quem comprovadamente passou do
// prazo.
export function filtrarPorRetencao(itens, agora) {
  const limite = limiteRetencaoLocal(agora).getTime()
  return (Array.isArray(itens) ? itens : []).filter((n) => {
    const t = new Date(n && n.ts).getTime()
    if (Number.isNaN(t)) return true
    return t >= limite
  })
}
