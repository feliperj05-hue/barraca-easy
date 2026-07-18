import { useEffect, useMemo, useState } from 'react'
import ProductGrid from '../components/ProductGrid.jsx'
import CartPanel from '../components/CartPanel.jsx'
import PaymentModal from '../components/PaymentModal.jsx'
import { formatBRL } from '../utils/money.js'
import {
  playAddToCart,
  playPaymentDone,
  isSoundEnabled,
  setSoundEnabled,
} from '../services/soundService.js'
import { getPrinterSettings, printOrder, isWebUsbSupported } from '../services/printerService.js'

const HERO_BY_MODE = {
  cashier_production_sync: {
    title: 'Pedido no caixa. Pagamento confirmado. Senha liberada.',
    text: 'O caixa monta o pedido, aguarda o pagamento, entrega a senha física e envia a venda para a produção.',
  },
  cashier_printer: {
    title: 'Modo Caixa + Impressora',
    text: 'A impressão do cupom térmico já está pronta (configure em Configurações → Impressora). A geração automática de senha pelo sistema ainda usa confirmação manual.',
  },
  self_service_kiosk: {
    title: 'Modo 100% Autônomo',
    text: 'Modo preparado para próxima fase. O fluxo completo de cliente autônomo e pagamento integrado ainda não foi implementado.',
  },
}

// Rascunho do carrinho (#56). Chave local e simples de proposito: e um
// rascunho do aparelho, nao dado de negocio — a venda so existe depois de
// confirmada, e ai vai para o backend normal.
const DRAFT_CART_KEY = 'barracaEasyDraftCart'

function loadDraftCart() {
  try {
    const raw = localStorage.getItem(DRAFT_CART_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    // So aceita pares id -> quantidade positiva; qualquer sujeira e ignorada.
    return Object.fromEntries(
      Object.entries(parsed).filter(([, qty]) => Number.isFinite(qty) && qty > 0),
    )
  } catch {
    return {}
  }
}

function saveDraftCart(cart) {
  try {
    if (!cart || Object.keys(cart).length === 0) {
      localStorage.removeItem(DRAFT_CART_KEY)
      return
    }
    localStorage.setItem(DRAFT_CART_KEY, JSON.stringify(cart))
  } catch {
    // Sem localStorage o app segue igual, so sem rascunho — nao pode quebrar
    // a venda por causa disso.
  }
}

export default function Cashier({ settings, menu, onCreateOrder, notify }) {
  // A lista efetiva vem da prop `menu` (cardápio ja carregado pelo App, local
  // ou nuvem). Filtramos os visiveis, derivamos as categorias e um indice por
  // id para o carrinho.
  const products = useMemo(() => menu.filter((p) => !p.hidden), [menu])
  const categories = useMemo(
    () => ['Todos', ...new Set(products.map((p) => p.category))],
    [products],
  )
  const productById = useMemo(
    () => Object.fromEntries(menu.map((p) => [p.id, p])),
    [menu],
  )
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  // O carrinho fica gravado no aparelho (#56). Antes vivia so em memoria: um
  // reload no meio da digitacao (atualizacao do app, bateria, aba reciclada
  // pelo Android) apagava o pedido com o cliente na frente.
  const [cart, setCart] = useState(loadDraftCart)
  const [payment, setPayment] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(null)
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())

  // Espelha o rascunho no localStorage a cada mudanca. E rascunho mesmo: some
  // quando o pedido e confirmado ou o carrinho e esvaziado.
  useEffect(() => {
    saveDraftCart(cart)
  }, [cart])

  const visibleProducts =
    selectedCategory === 'Todos'
      ? products
      : products.filter((p) => p.category === selectedCategory)

  const items = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const product = productById[id]
          if (!product) return null
          return {
            id,
            name: product.name,
            category: product.category,
            price: product.price,
            qty,
            subtotal: product.price * qty,
          }
        })
        .filter(Boolean),
    [cart, productById],
  )
  const count = items.reduce((sum, item) => sum + item.qty, 0)
  const total = items.reduce((sum, item) => sum + item.subtotal, 0)

  const hero = HERO_BY_MODE[settings.operationMode] || HERO_BY_MODE.cashier_production_sync

  function addToCart(id) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }))
    notify('Item adicionado')
    playAddToCart()
  }

  function toggleSound() {
    setSoundOn(setSoundEnabled(!soundOn))
  }

  function changeQty(id, delta) {
    setCart((c) => {
      const next = { ...c, [id]: (c[id] || 0) + delta }
      if (next[id] <= 0) delete next[id]
      return next
    })
  }

  function openModal() {
    if (settings.operationMode !== 'cashier_production_sync') {
      return notify('Este modo está pré-configurado. O fluxo completo será implementado em fase futura.')
    }
    if (!items.length) return notify('Adicione pelo menos um item.')
    if (!payment) return notify('Selecione a forma de pagamento.')
    setModalOpen(true)
  }

  async function confirmPaid(ticketValue) {
    const order = await onCreateOrder({ items, payment, total, ticket: ticketValue })
    if (!order) return // erro (ex: senha duplicada) já foi avisado via toast
    playPaymentDone()
    setModalOpen(false)
    setConfirmed(order)
    setCart({})
    setPayment(null)
    // Cupom sai depois da venda ja registrada e SEM travar a tela (#63).
    // Impressora sem papel, cabo solto ou desligada viram aviso — jamais
    // podem desfazer ou segurar uma venda que o cliente ja pagou.
    const printerCfg = getPrinterSettings()
    if (printerCfg.enabled) {
      printOrder(order, printerCfg).then((result) => {
        if (!result.printed) notify('Cupom não impresso: ' + result.reason)
      })
    }
  }

  async function reprint() {
    if (!confirmed) return
    const result = await printOrder(confirmed)
    notify(result.printed ? 'Cupom enviado à impressora.' : result.reason)
  }

  function newSale() {
    setConfirmed(null)
  }

  if (confirmed) {
    return (
      <section className="ticket-screen">
        <div className="ticket-card">
          <h2>Venda confirmada</h2>
          <p className="muted">Senha registrada no sistema:</p>
          <div className="ticket-number">{confirmed.ticket}</div>
          <p className="muted">
            {formatBRL(confirmed.total)} • {confirmed.payment} confirmado
          </p>
          {isWebUsbSupported() && (
            <button type="button" className="btn-secondary big-action" onClick={reprint}>
              Imprimir cupom
            </button>
          )}
          <button type="button" className="btn-primary big-action" onClick={newSale}>
            Próximo cliente
          </button>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="hero">
        <div>
          <h2>{hero.title}</h2>
          <p>{hero.text}</p>
        </div>
        <div className="hero-card">
          <span>Fluxo real: pedido, pagamento, senha física e retirada.</span>
          <strong>Easy</strong>
        </div>
      </div>

      <div className="layout">
        <div className="panel">
          <div className="panel-title">
            <h2>Lançar pedido</h2>
            <button
              type="button"
              className="btn-secondary small"
              onClick={toggleSound}
              aria-pressed={soundOn}
              title={soundOn ? 'Sons ligados — tocar para silenciar' : 'Sons desligados — tocar para ativar'}
            >
              {soundOn ? '🔊 Som' : '🔇 Mudo'}
            </button>
          </div>
          <ProductGrid
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            products={visibleProducts}
            onAdd={addToCart}
          />
        </div>

        <CartPanel
          items={items}
          count={count}
          total={total}
          onChangeQty={changeQty}
          payment={payment}
          onSelectPayment={setPayment}
          onConfirm={openModal}
        />
      </div>

      <PaymentModal
        open={modalOpen}
        total={total}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmPaid}
      />
    </section>
  )
}
