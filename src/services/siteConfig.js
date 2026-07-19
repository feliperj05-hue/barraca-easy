// Enderecos publicos do produto — fonte unica (#111).
//
// POR QUE ISTO EXISTE. O dominio proprio ainda vai ser contratado, e a ordem
// e "deixar tudo pronto antes e depois virar". Se cada canonical, og:url e
// link de compartilhamento nascer com o dominio escrito no meio do JSX, a
// virada vira cacada a string pelo repositorio inteiro. Aqui e uma linha.
//
// Em build: defina VITE_SITE_URL no ambiente. Sem ela, cai no host atual.
//
// ATENCAO NA VIRADA DE DOMINIO: origem nova e outro sandbox do navegador.
// localStorage, IndexedDB, fila offline e service worker NAO migram sozinhos.
// Isso vale inclusive para o plano escolhido no site comercial, que e gravado
// em localStorage (ver services/selectedPlan.js): quem escolher um plano no
// dominio velho e so terminar o cadastro no novo perde a pre-selecao. E so a
// pre-selecao, nao a venda — o dono escolhe de novo dentro do app.
// O dominio escolhido para a marca e `barracaeasy.com.br` (SEM hifen). Ele
// AINDA NAO FOI REGISTRADO, entao NAO pode ser o default: canonical e link
// clicavel apontando para dominio que nao resolve quebra SEO e da 404. O
// default fica no host que existe hoje. A virada e trocar VITE_SITE_URL.
//
// NAO uniformize os nomes: o projeto Firebase, o repositorio e o host usam
// `barraca-easy` COM hifen; o dominio da marca e sem. Nao e typo.
export const DOMINIO_FUTURO = 'https://barracaeasy.com.br'

export const SITE_URL = String(
  import.meta.env.VITE_SITE_URL || 'https://barraca-easy.web.app',
).replace(/\/+$/, '')

// --- Contato -----------------------------------------------------------
//
// E-mail oficial definido pelo Felipe (#114).
//
// POR QUE ELE VEM COM INTERRUPTOR. O dominio `barracaeasy.com.br` ainda NAO
// foi registrado (ver DOMINIO_FUTURO acima). Enquanto isso, este endereco nao
// existe: quem escrever recebe devolucao do servidor. Publicar canal de
// contato morto numa pagina que vende assinatura e pior do que nao publicar
// canal nenhum — o cliente acha que falou com a gente e fica esperando.
//
// Entao o endereco fica pronto e guardado aqui, e so aparece na tela quando
// VITE_CONTATO_ATIVO estiver ligado. Virar e mudar variavel de ambiente, sem
// deploy de codigo novo.
//
// Enquanto esta desligado, o site mostra o caminho que FUNCIONA hoje: o botao
// "Fale com o desenvolvedor", dentro do proprio app.
export const CONTATO_EMAIL = String(
  import.meta.env.VITE_CONTATO_EMAIL || 'contato@barracaeasy.com.br',
).trim()

export const CONTATO_ATIVO =
  String(import.meta.env.VITE_CONTATO_ATIVO || '').toLowerCase() === 'true'

// O e-mail so existe para a tela quando o dominio estiver de pe.
export function contatoVisivel() {
  return CONTATO_ATIVO && CONTATO_EMAIL.length > 0
}

export function mailtoContato(assunto = '') {
  const q = assunto ? '?subject=' + encodeURIComponent(assunto) : ''
  return 'mailto:' + CONTATO_EMAIL + q
}

// Prefixo do site comercial. A raiz "/" continua sendo o APLICATIVO de
// proposito: mexer nela muda o start_url do PWA e faria o tablet ja instalado
// no piloto abrir na pagina de vendas. Trocar a home e decisao de produto
// pendente (#107 item 3, #111) — quando o Felipe decidir, muda aqui.
export const MARKETING_BASE = '/comercial'

// Onde mora o aplicativo.
export const APP_BASE = '/'

// Paginas juridicas: apontam para o site estatico (#107), que ja tem o texto
// de verdade. O pacote externo trazia placeholder "em breve" no lugar — seria
// um site comercial vendendo assinatura com politica de privacidade vazia.
export const URL_PRIVACIDADE = '/site/privacidade.html'
export const URL_TERMOS = '/site/termos.html'

// Link interno do site comercial. `mkt('/')` devolve a home comercial.
export function mkt(path = '/') {
  const p = String(path)
  if (p === '/' || p === '') return MARKETING_BASE
  if (p.startsWith('#')) return MARKETING_BASE + p
  return MARKETING_BASE + (p.startsWith('/') ? p : '/' + p)
}

// Link para o aplicativo. `app('?acao=cadastro')` leva direto ao cadastro.
export function app(query = '') {
  return APP_BASE + String(query || '')
}

// URL absoluta, para canonical/og:url e compartilhamento.
export function absoluta(path = '/') {
  const p = String(path || '/')
  return SITE_URL + (p.startsWith('/') ? p : '/' + p)
}

export function ehRotaMarketing(pathname) {
  const limpo = String(pathname || '').replace(/\/+$/, '') || '/'
  return limpo === MARKETING_BASE || limpo.startsWith(MARKETING_BASE + '/')
}
