/**
 * Gera a previa estatica da identidade visual — issue #71.
 *
 * Le o app.css de verdade e embute num HTML unico, com as 4 telas na
 * ordem que o Felipe pediu. Como usa a folha real, se alguem mexer numa
 * cor a previa muda junto: nao existe versao "de propaganda" divergindo
 * do que o operador ve no balcao.
 *
 * Uso: npm run previa  ->  public/previa-visual.html
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(raiz, 'src/styles/app.css'), 'utf8')

const engrenagem = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94a7.6 7.6 0 0 0 .06-.94 7.6 7.6 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.62l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.24-1.12.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.86a.5.5 0 0 0 .12.62l2.03 1.58c-.04.31-.06.62-.06.94 0 .32.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.62l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.24 1.12-.56 1.62-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.62l-2.03-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z"/></svg>`

/** Cabecalho real do app, com a aba ativa variavel. */
function cabecalho(ativa) {
  const abas = ['Caixa', 'Produção', 'Fechamento']
    .map(
      (a) =>
        `<button type="button" class="nav-btn${a === ativa ? ' active-tab' : ''}">${a}</button>`,
    )
    .join('\n            ')
  return `<header class="app-header">
        <div class="brand">
          <div class="logo">B</div>
          <div>
            <h1>Barraca Easy</h1>
            <p class="brand-sub">Barraca do Seu Zé · Feira de Messejana</p>
          </div>
        </div>
        <span class="conn-status" data-state="ok">
          <span class="conn-dot"></span><span class="conn-label">Conectado</span>
        </span>
        <nav class="app-nav">
            ${abas}
        </nav>
        <div class="app-account">
          <button type="button" class="icon-btn settings-gear${ativa === 'Ajustes' ? ' active' : ''}" title="Configurações">${engrenagem}</button>
          <span class="account-info">Zé Maria<span class="account-role"> · dono</span></span>
          <button type="button" class="btn-ghost small">Sair</button>
        </div>
      </header>`
}

const produtos = [
  ['🥟', 'Coxinha artesanal', 'R$ 8,00'],
  ['🥤', 'Suco natural', 'R$ 7,00'],
  ['🍰', 'Bolo de pote', 'R$ 10,00'],
  ['🌭', 'Cachorro-quente', 'R$ 12,00'],
  ['🍫', 'Brigadeiro', 'R$ 4,00'],
  ['🍽️', 'Combo família', 'R$ 32,00'],
]
  .map(
    ([e, n, p]) => `<div class="product">
              <div>
                <div class="emoji">${e}</div>
                <h3>${n}</h3>
                <div class="price">${p}</div>
              </div>
              <button type="button" class="btn-add">Adicionar</button>
            </div>`,
  )
  .join('\n            ')

const categorias = ['Todos', 'Salgados', 'Doces', 'Bebidas', 'Combos']
  .map(
    (c, i) =>
      `<button type="button" class="category-btn${i === 0 ? ' selected' : ''}">${c}</button>`,
  )
  .join('\n            ')

const TELA_CAIXA = `<section>
      <div class="hero">
        <div>
          <h2>Caixa</h2>
          <p>Monte o pedido, receba o pagamento e informe a senha física entregue.</p>
        </div>
        <div class="hero-card">
          <span>Fluxo real: pedido, pagamento, senha física e retirada.</span>
          <strong>Easy</strong>
        </div>
      </div>

      <div class="layout">
        <div class="panel">
          <div class="panel-title">
            <h2>Lançar pedido</h2>
            <button type="button" class="btn-secondary small">🔊 Som</button>
          </div>
          <div class="categories">
            ${categorias}
          </div>
          <div class="products">
            ${produtos}
          </div>
        </div>

        <aside class="panel">
          <div class="panel-title">
            <h2>Venda atual</h2>
            <span class="muted">4 itens</span>
          </div>
          <div class="cart-list">
            <div class="cart-item">
              <div><strong>Coxinha artesanal</strong><br><span class="muted">R$ 8,00 cada</span></div>
              <div class="qty"><button type="button">−</button><strong>2</strong><button type="button">+</button></div>
            </div>
            <div class="cart-item">
              <div><strong>Suco natural</strong><br><span class="muted">R$ 7,00 cada</span></div>
              <div class="qty"><button type="button">−</button><strong>1</strong><button type="button">+</button></div>
            </div>
            <div class="cart-item">
              <div><strong>Bolo de pote</strong><br><span class="muted">R$ 10,00 cada</span></div>
              <div class="qty"><button type="button">−</button><strong>1</strong><button type="button">+</button></div>
            </div>
          </div>

          <h3>Pagamento recebido</h3>
          <div class="payment-grid">
            <button type="button" class="selected">Pix</button>
            <button type="button">Cartão</button>
            <button type="button">Dinheiro</button>
          </div>

          <div class="notice">
            Após montar o pedido, confirme o pagamento no caixa. Só então entregue a senha física e
            informe o número liberado ao cliente.
          </div>

          <div class="total"><span>Total</span><span>R$ 33,00</span></div>
          <button type="button" class="btn-primary big-action">Confirmar pedido</button>
        </aside>
      </div>
    </section>`

function pedido(senha, total, pagamento, chamado, itens) {
  return `<div class="order-card">
              <div class="order-head">
                <div class="ticket-badge">${senha}</div>
                <div><strong>${total}</strong><br><span class="muted">${pagamento}</span></div>
                <span class="status${chamado ? ' called' : ''}">${chamado ? 'Chamado' : 'Aguardando'}</span>
              </div>
              <div class="items">${itens.map((i) => `<div>${i}</div>`).join('')}</div>
              <div class="actions">
                ${chamado ? '' : '<button type="button" class="btn-primary">Chamar senha</button>'}
                <button type="button" class="btn-ok">Entregue / OK</button>
                <button type="button" class="btn-danger">Cancelar</button>
              </div>
            </div>`
}

const TELA_PRODUCAO = `<section>
      <div class="hero">
        <div>
          <h2>Fila de produção</h2>
          <p>Os pedidos aparecem na ordem da senha. A equipe chama a senha física e marca como entregue.</p>
        </div>
        <div class="hero-card">
          <span>Pedidos pendentes</span>
          <strong>3</strong>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title"><h2>Pedidos em aberto</h2></div>
        <div class="orders">
            ${pedido('A12', 'R$ 33,00', 'Pix', false, ['2x Coxinha artesanal', '1x Suco natural', '1x Bolo de pote'])}
            ${pedido('A13', 'R$ 12,00', 'Dinheiro', true, ['1x Cachorro-quente'])}
            ${pedido('A14', 'R$ 32,00', 'Cartão', false, ['1x Combo família'])}
        </div>
      </div>
    </section>`

const metricas = [
  ['Total vendido', 'R$ 684,00'],
  ['Vendas confirmadas', '42'],
  ['Entregues', '35'],
  ['Ticket médio', 'R$ 16,29'],
]
  .map(([k, v]) => `<div class="metric"><span>${k}</span><strong>${v}</strong></div>`)
  .join('\n          ')

const TELA_FECHAMENTO = `<section>
      <div class="hero">
        <div>
          <h2>Fechamento do dia</h2>
          <p>Só entram vendas confirmadas e não canceladas. Pedido cancelado fica fora do faturamento.</p>
        </div>
        <div class="hero-card"><span>Pedidos hoje</span><strong>42</strong></div>
      </div>

      <div class="summary-grid">
          ${metricas}
      </div>

      <div class="two-cols">
        <div class="panel">
          <div class="panel-title"><h2>Por pagamento</h2></div>
          <div class="summary-row"><strong>Pix</strong><span>R$ 402,00</span></div>
          <div class="summary-row"><strong>Cartão</strong><span>R$ 190,00</span></div>
          <div class="summary-row"><strong>Dinheiro</strong><span>R$ 92,00</span></div>
        </div>
        <div class="panel">
          <div class="panel-title"><h2>Por produto</h2></div>
          <div class="summary-row"><strong>Coxinha artesanal<br><span class="muted">38 un.</span></strong><span>R$ 304,00</span></div>
          <div class="summary-row"><strong>Combo família<br><span class="muted">7 un.</span></strong><span>R$ 224,00</span></div>
          <div class="summary-row"><strong>Suco natural<br><span class="muted">22 un.</span></strong><span>R$ 154,00</span></div>
        </div>
      </div>

      <p class="muted" style="margin-top:16px">2 pedido(s) cancelado(s) — fora do faturamento.</p>

      <div class="close-register">
        <div>
          <strong>Fechar caixa</strong>
          <p class="muted">Gera o relatório do período e zera a produção. As vendas atuais saem da fila e ficam guardadas no histórico abaixo.</p>
        </div>
        <button type="button" class="btn-primary">Fechar caixa</button>
      </div>
    </section>`

// Rotulos identicos aos de SETTINGS_SECTIONS (src/services/permissions.js):
// previa que inventa nome de menu engana quem aprova.
const navAjustes = [
  ['🏪', 'Dados da barraca', 'Nome, contato e o que sai no cupom'],
  ['🍽️', 'Cardápio', 'Itens, preços e o que aparece no caixa'],
  ['👥', 'Membros e permissões', 'Quem opera a barraca e o que cada um pode'],
  ['⚙️', 'Modo de operação', 'Como a barraca trabalha no dia a dia'],
  ['🧾', 'Impressão', 'Impressora térmica e layout do cupom'],
]
  .map(
    ([ic, t, s], i) =>
      `<button type="button" class="settings-nav-btn${i === 3 ? ' active' : ''}">
              <span class="settings-nav-icon">${ic}</span>
              <span class="settings-nav-text"><strong>${t}</strong><span class="small muted">${s}</span></span>
            </button>`,
  )
  .join('\n            ')

function modo(n, titulo, texto, pronto, selecionado) {
  return `<div class="mode-card${selecionado ? ' selected' : ''}">
              <div class="mode-number">${n}</div>
              <h3>${titulo}</h3>
              <p>${texto}</p>
              <div class="mode-bottom">
                <span class="mode-status${pronto ? ' ready' : ''}">${pronto ? 'Completo no MVP' : 'Próxima fase'}</span>
                <button type="button" class="btn-secondary">${selecionado ? 'Modo selecionado' : 'Selecionar modo'}</button>
              </div>
            </div>`
}

const TELA_AJUSTES = `<section>
      <div class="hero">
        <div>
          <h2>Configurações</h2>
          <p>Ajuste antes de abrir a barraca. Durante a venda, ninguém precisa entrar aqui.</p>
        </div>
        <div class="hero-card"><span>Modo em uso</span><strong>Sincronizado</strong></div>
      </div>

      <div class="settings-layout">
        <div class="settings-nav">
            ${navAjustes}
        </div>
        <div class="settings-content">
          <div class="panel">
            <div class="panel-title">
              <h2>Modo de operação</h2>
              <span class="settings-badge">3 modos</span>
            </div>
            <div class="settings-grid">
              ${modo(1, 'Caixa + Impressora', 'O caixa imprime a senha no cupom. Sem tela de produção.', false, false)}
              ${modo(2, 'Sincronizado com Produção', 'Caixa e cozinha na mesma fila. Senha física em papel.', true, true)}
              ${modo(3, '100% Autônomo', 'O cliente pede sozinho no totem e o sistema gera a senha.', false, false)}
            </div>
          </div>
        </div>
      </div>
    </section>`

const TELAS = [
  ['1. Caixa', 'Caixa', TELA_CAIXA],
  ['2. Produção', 'Produção', TELA_PRODUCAO],
  ['3. Fechamento', 'Fechamento', TELA_FECHAMENTO],
  ['4. Configurações', 'Ajustes', TELA_AJUSTES],
]

const corpo = TELAS.map(
  ([rotulo, ativa, conteudo]) => `  <p class="previa-rotulo">${rotulo}</p>
  <div class="previa-quadro">
    <div class="app">
      ${cabecalho(ativa)}
      <main class="app-main">
        ${conteudo}
      </main>
    </div>
  </div>`,
).join('\n\n')

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Barraca Easy — prévia da identidade visual</title>
<style>
${css}

/* --- so da previa, nao vai pro app --- */
body { padding: 24px; }
.previa-cabeca { max-width: 1220px; margin: 0 auto 28px; }
.previa-cabeca h1 { font-size: 30px; margin-bottom: 8px; }
.previa-cabeca p { color: var(--cor-texto-suave); line-height: 1.5; max-width: 70ch; }
.previa-rotulo {
  max-width: 1220px;
  margin: 34px auto 10px;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cor-texto-suave);
}
.previa-quadro {
  max-width: 1220px;
  margin: 0 auto;
  border: 1px solid var(--cor-borda-forte);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--cor-fundo);
}
.previa-quadro .app-header { position: static; }
.previa-paleta { max-width: 1220px; margin: 34px auto 0; display: flex; flex-wrap: wrap; gap: 10px; }
.previa-amostra {
  border: 1px solid var(--cor-borda);
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--cor-superficie);
  font-size: 12px;
  font-weight: 700;
}
.previa-amostra i { display: block; width: 100%; height: 28px; border-radius: 6px; margin-bottom: 6px; }
</style>
</head>
<body>
<div class="previa-cabeca">
  <h1>Barraca Easy — prévia da identidade visual</h1>
  <p>
    Prévia estática das 4 telas usando a folha de estilo real do app. Nada aqui é clicável:
    é para conferir cor, peso e hierarquia antes de bater o martelo. Todo par de cor/fundo
    passou por WCAG AA (<code>npm run contraste</code>).
  </p>
</div>

${corpo}

<p class="previa-rotulo">Paleta em uso</p>
<div class="previa-paleta">
  ${[
    ['Ação / CTA', '#f45f0d'],
    ['Ação pressionada', '#d24f08'],
    ['Laranja como texto', '#9a4413'],
    ['Institucional', '#ca6129'],
    ['Acento suave', '#e9a475'],
    ['Status positivo', '#488e42'],
    ['Status (texto)', '#3d5337'],
    ['Nav / carvão', '#3c3835'],
    ['Texto suave', '#5c5b53'],
    ['Fundo areia', '#eae1d3'],
    ['Papel', '#fffaf2'],
  ]
    .map(
      ([n, h]) =>
        `<span class="previa-amostra"><i style="background:${h}"></i>${n}<br>${h}</span>`,
    )
    .join('\n  ')}
</div>

<script>
  // ?tela=N mostra so uma tela. Serve pra conferir/print de tela isolada;
  // sem parametro, a previa mostra as quatro empilhadas.
  var alvo = new URLSearchParams(location.search).get('tela')
  if (alvo) {
    var rotulos = document.querySelectorAll('.previa-rotulo')
    var quadros = document.querySelectorAll('.previa-quadro')
    var i = parseInt(alvo, 10) - 1
    document.querySelector('.previa-cabeca').style.display = 'none'
    document.querySelector('.previa-paleta').style.display = 'none'
    rotulos.forEach(function (r, k) { if (k !== i) r.style.display = 'none' })
    quadros.forEach(function (q, k) { if (k !== i) q.style.display = 'none' })
    if (rotulos[i]) rotulos[i].style.marginTop = '0'
  }
</script>
</body>
</html>
`

writeFileSync(join(raiz, 'public/previa-visual.html'), html)
console.log('previa gerada: public/previa-visual.html')
