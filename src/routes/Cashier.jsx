import { useMemo, useState } from 'react'
import ProductGrid from '../components/ProductGrid.jsx'
import CartPanel from '../components/CartPanel.jsx'
import PaymentModal from '../components/PaymentModal.jsx'
import { getProducts, getCategories, findProduct } from '../services/productService.js'
import { formatBRL } from '../utils/money.js'

const HERO_BY_MODE = {
  cashier_production_sync: {
    title: 'Pedido no caixa. Pagamento confirmado. Senha liberada.',
    text: 'O caixa monta o pedido, aguarda o pagamento, entrega a senha física e envia a venda para a produção.',
  },
  cashier_printer: {
    title: 'Modo Caixa + Impressora',
    text: 'Protótipo preparado para caixa com senha impressa ou física. Nesta fase, o fluxo ainda usa confirmação manual.',
  },
  self_service_kiosk: {
    title: 'Modo 100% Autônomo',
    text: 'Modo preparado para próxima fase. O fluxo completo de cliente autônomo e pagamento integrado ainda não foi implementado.',
  },
}

export default function Cashier({ settings, onCreateOrder, notify }) {
  const products = getProducts()
  const categories = getCategories()
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [cart, setCart] = useState({})
  const [payment, setPayment] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(null)

  const visibleProducts =
    selectedCategory === 'Todos'
      ? products
      : products.filter((p) => p.category === selectedCategory)

  const items = useMemo(
    () =>
      Object.entries(cart).map(([id, qty]) => {
        const product = findProduct(id)
        return { id, name: product.name, price: product.price, qty, subtotal: product.price * qty }
      }),
    [cart],
  )
  const count = items.reduce((sum, item) => sum + item.qty, 0)
  const total = items.reduce((sum, item) => sum + item.subtotal, 0)

  const hero = HERO_BY_MODE[settings.operationMode] || HERO_BY_MODE.cashier_production_sync

  function addToCart(id) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }))
    notify('Item adicionado')
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
      notify('Este modo está pré-configurado. O fluxo completo será implementado em fase futura.')
    }
    if (!items.length) return notify('Adicione pelo menos um item.')
    if (!payment) return notify('Selecione a forma de pagamento.')
    setModalOpen(true)
  }

  function confirmPaid(ticketValue) {
    const order = onCreateOrder({ items, payment, total, ticket: ticketValue })
    if (!order) return // erro (ex: senha duplicada) já foi avisado via toast
    setModalOpen(false)
    setConfirmed(order)
    setCart({})
    setPayment(null)
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
            <span className="muted">Operação do caixa</span>
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
