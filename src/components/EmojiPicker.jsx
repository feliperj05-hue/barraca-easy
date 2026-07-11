// Grade curada de emojis (comidas e bebidas) para representar o item do
// cardápio. Sem upload de foto no MVP (issue #22).
const EMOJIS = [
  '🥟', '🥧', '🍰', '🎂', '🧁', '🍮', '🍫', '🍪', '🍩', '🍬',
  '🍭', '🍦', '🍨', '🥐', '🥖', '🍞', '🥯', '🧇', '🥞', '🍿',
  '🍔', '🌭', '🍕', '🍟', '🥪', '🌮', '🌯', '🫓', '🥙', '🧆',
  '🥗', '🍝', '🍜', '🍲', '🥘', '🍛', '🍱', '🍤', '🍗', '🥩',
  '🍳', '🧀', '🥤', '🧃', '🧋', '☕', '🍵', '🧉', '🍺', '🍷',
  '🥛', '🧊', '🍓', '🍊', '🍎', '🍌', '🍇', '🥑', '🌽', '⚡',
]

export default function EmojiPicker({ value, onSelect }) {
  return (
    <div className="emoji-picker" role="listbox" aria-label="Escolha um emoji">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="option"
          aria-selected={value === emoji}
          className={'emoji-option' + (value === emoji ? ' selected' : '')}
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
