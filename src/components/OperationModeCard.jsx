export default function OperationModeCard({ mode, selected, onSelect }) {
  const isMvp = mode.status === 'mvp'
  return (
    <div className={'mode-card' + (selected ? ' selected' : '')}>
      <div className="mode-number">{mode.number}</div>

      <div>
        <h3>{mode.name}</h3>
        <p>{mode.description}</p>
      </div>

      <div>
        <strong>Ideal para:</strong>
        <ul>
          {mode.ideal.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="config-preview">
        {mode.preview.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      <div className="mode-bottom">
        <span className={'mode-status' + (isMvp ? ' ready' : '')}>{mode.statusLabel}</span>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onSelect(mode.key)}
        >
          {selected ? 'Modo selecionado' : 'Selecionar modo'}
        </button>
      </div>
    </div>
  )
}
