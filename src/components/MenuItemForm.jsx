import { useEffect, useState } from 'react'
import EmojiPicker from './EmojiPicker.jsx'

// Formulário (modal) para criar ou editar um item custom do cardápio.
// initial = null -> criação; initial = item -> edição.
export default function MenuItemForm({ open, initial, categories, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(categories[0] || '')
  const [price, setPrice] = useState('')
  const [emoji, setEmoji] = useState('🍽️')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(initial?.name || '')
    setDescription(initial?.description || '')
    setCategory(initial?.category || categories[0] || '')
    setPrice(initial ? String(initial.price) : '')
    setEmoji(initial?.emoji || '🍽️')
    setError('')
  }, [open, initial, categories])

  if (!open) return null

  function handleSubmit() {
    const trimmedName = name.trim()
    const value = Number(String(price).replace(',', '.'))
    if (!trimmedName) return setError('Informe o nome do item.')
    if (!emoji) return setError('Escolha um emoji para o item.')
    if (!Number.isFinite(value) || value <= 0) return setError('Informe um preço válido.')
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      category,
      price: Math.round(value * 100) / 100,
      emoji,
    })
  }

  return (
    <div className="modal-backdrop show" onClick={onClose}>
      <div className="modal menu-form" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Editar item' : 'Novo item'}</h2>

        <div className="field">
          <label>Emoji</label>
          <div className="emoji-preview">{emoji}</div>
          <EmojiPicker value={emoji} onSelect={setEmoji} />
        </div>

        <div className="field">
          <label htmlFor="menu-item-name">Nome</label>
          <input
            id="menu-item-name"
            className="text-input"
            type="text"
            maxLength={40}
            placeholder="Ex: Cachorro-quente"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="menu-item-desc">Descrição (opcional)</label>
          <textarea
            id="menu-item-desc"
            className="text-input"
            maxLength={120}
            placeholder="Ex: Com purê, batata palha e molhos"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="menu-item-cat">Categoria</label>
          <select
            id="menu-item-cat"
            className="text-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="menu-item-price">Preço (R$)</label>
          <input
            id="menu-item-price"
            className="text-input"
            inputMode="decimal"
            placeholder="Ex: 12,50"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit}>
            {initial ? 'Salvar' : 'Adicionar item'}
          </button>
        </div>
      </div>
    </div>
  )
}
