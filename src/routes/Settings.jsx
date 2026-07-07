import OperationModeCard from '../components/OperationModeCard.jsx'
import { getModeList, getCurrentMode } from '../services/settingsService.js'

export default function Settings({ settings, onSelectMode, onResetSettings }) {
  const modes = getModeList()
  const current = getCurrentMode(settings)

  return (
    <section>
      <div className="hero">
        <div>
          <h2>Configurações do sistema</h2>
          <p>
            Escolha o modo de operação da barraca. O modo padrão do MVP é o sincronizado com
            produção.
          </p>
        </div>
        <div className="hero-card">
          <span>Modo atual</span>
          <strong>{current.short}</strong>
        </div>
      </div>

      <div className="current-mode-box">
        <div>
          <span className="muted">Modo selecionado</span>
          <strong>{current.name}</strong>
          <p className="muted">{current.description}</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onResetSettings}>
          Restaurar padrão
        </button>
      </div>

      <div className="settings-grid">
        {modes.map((mode) => (
          <OperationModeCard
            key={mode.key}
            mode={mode}
            selected={mode.key === settings.operationMode}
            onSelect={(key) => onSelectMode(key, mode.name)}
          />
        ))}
      </div>
    </section>
  )
}
