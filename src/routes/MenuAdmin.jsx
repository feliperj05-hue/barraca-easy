import { useMemo, useState } from 'react'
import MenuItemForm from '../components/MenuItemForm.jsx'
import { getMenuCategories } from '../services/productService.js'

function parsePrice(text) {
  const value = Number(String(text).replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}

// Uma linha do cardápio: emoji, nome/descrição, preço editável inline,
// toggle de visibilidade e, para itens custom, editar/remover.
function MenuRow({ item, onSetPrice, onToggleHidden, onEdit, onRemove }) {
  const [priceText, setPriceText] = useState(String(item.price))

  function commitPrice() {
    const value = parsePrice(priceText)
    if (value == null) {
      setPriceText(String(item.price)) // reverte entrada inválida
      return
    }
    if (value !== item.price) onSetPrice(item.id, value)
  }

  return (
    <div className={'menu-row' + (item.hidden ? ' is-hidden' : '')}>
      <div className="menu-row-emoji">{item.emoji}</div>

      <div className="menu-row-info">
        <strong>{item.name}</strong>
        {item.description && <span className="muted">{item.description}</span>}
        <span className="menu-row-tag">{item.custom ? 'Criado por você' : 'Padrão'}</span>
      </div>

      <div className="menu-row-price">
        <span className="menu-row-price-label">Preço</span>
        <input
          className="price-input"
          inputMode="decimal"
          value={priceText}
          onChange={(e) => setPriceText(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </div>

      <div className="menu-row-actions">
        <button
          type="button"
          className={'toggle-btn' + (item.hidden ? '' : ' on')}
          onClick={() => onToggleHidden(item.id, !item.hidden)}
        >
          {item.hidden ? 'Oculto' : 'Visível'}
        </button>
        {item.custom && (
          <>
            <button type="button" className="btn-ghost small" onClick={() => onEdit(item)}>
              Editar
            </button>
            <button type="button" className="btn-danger small" onClick={() => onRemove(item)}>
              Remover
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function MenuAdmin({
  menu,
  onSetPrice,
  onToggleHidden,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onResetMenu,
  embedded = false,
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const categories = getMenuCategories()

  // Agrupa por categoria, preservando a ordem canônica do seed.
  const groups = useMemo(() => {
    return categories
      .map((cat) => ({ category: cat, items: menu.filter((p) => p.category === cat) }))
      .filter((g) => g.items.length > 0)
  }, [menu, categories])

  const visibleCount = menu.filter((p) => !p.hidden).length

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setFormOpen(true)
  }

  function handleSubmit(payload) {
    if (editing) onUpdateItem(editing.id, payload)
    else onAddItem(payload)
    setFormOpen(false)
    setEditing(null)
  }

  return (
    <section className={embedded ? 'menu-admin embedded' : 'menu-admin'}>
      {embedded ? (
        // Dentro de Configuracoes o cabecalho da tela ja existe; repetir o hero
        // aqui empurraria o cardapio pra baixo da dobra no tablet.
        <div className="panel-title">
          <h2>Cardápio</h2>
          <span className="settings-badge">{visibleCount} visível(is) no caixa</span>
        </div>
      ) : (
        <div className="hero">
          <div>
            <h2>Cardápio</h2>
            <p>
              Mostre ou oculte itens, ajuste preços e crie novos produtos. Os itens padrão sempre
              voltam ao restaurar o cardápio.
            </p>
          </div>
          <div className="hero-card">
            <span>Itens visíveis no caixa</span>
            <strong>{visibleCount}</strong>
          </div>
        </div>
      )}

      <div className="menu-toolbar">
        <button type="button" className="btn-primary" onClick={openNew}>
          + Novo item
        </button>
        <button type="button" className="btn-ghost" onClick={onResetMenu}>
          Restaurar cardápio
        </button>
      </div>

      {groups.map((group) => (
        <div className="menu-group" key={group.category}>
          <h3 className="menu-group-title">{group.category}</h3>
          <div className="menu-list">
            {group.items.map((item) => (
              <MenuRow
                key={item.id}
                item={item}
                onSetPrice={onSetPrice}
                onToggleHidden={onToggleHidden}
                onEdit={openEdit}
                onRemove={onRemoveItem}
              />
            ))}
          </div>
        </div>
      ))}

      <MenuItemForm
        open={formOpen}
        initial={editing}
        categories={categories}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
      />
    </section>
  )
}
