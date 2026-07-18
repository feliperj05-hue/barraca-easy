import { formatBRL } from '../utils/money.js'

export default function ProductGrid({
  categories,
  selectedCategory,
  onSelectCategory,
  products,
  onAdd,
}) {
  return (
    <>
      <div className="categories">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={'category-btn' + (selectedCategory === cat ? ' selected' : '')}
            onClick={() => onSelectCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="products">
        {products.map((p) => (
          <div className="product" key={p.id}>
            <div>
              <div className="emoji">{p.emoji}</div>
              <h3>{p.name}</h3>
              <div className="price">{formatBRL(p.price)}</div>
            </div>
            <button type="button" className="btn-add" onClick={() => onAdd(p.id)}>
              Adicionar
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
