import { useState } from 'react'
import OperationModeCard from '../components/OperationModeCard.jsx'
import CloudStatus from '../components/CloudStatus.jsx'
import PrinterSettingsCard from '../components/PrinterSettingsCard.jsx'
import BusinessSettingsCard from '../components/BusinessSettingsCard.jsx'
import PilotCard from '../components/PilotCard.jsx'
import TicketModeCard from '../components/TicketModeCard.jsx'
import MenuAdmin from './MenuAdmin.jsx'
import Members from './Members.jsx'
import { getModeList, getCurrentMode } from '../services/settingsService.js'
import { SETTINGS_SECTIONS, visibleFor } from '../services/permissions.js'

// Tela de Configuracoes (issue #68).
//
// Deixou de ser uma pagina corrida e virou um shell com secoes. Cardapio e
// Membros vieram para ca de vez: eram abas da barra principal, mas ninguem
// mexe em preco com fila no balcao — a barra de cima ficou so com Caixa,
// Producao e Fechamento, e todo o resto mora atras da engrenagem.
//
// A navegacao das secoes e uma coluna de botoes grandes (alvo de dedo em
// tablet), que vira uma fileira rolavel no retrato.
export default function Settings({
  settings,
  onSelectMode,
  onResetSettings,
  notify,
  role,
  tenantNome,
  menuProps,
  pilotContext,
  vendasNoCaixa,
  onTicketModeChange,
}) {
  const sections = visibleFor(SETTINGS_SECTIONS, role)
  const [active, setActive] = useState(() => (sections[0] ? sections[0].id : 'mode'))
  const current = sections.some((s) => s.id === active) ? active : sections[0]?.id
  const activeSection = sections.find((s) => s.id === current)

  const modes = getModeList()
  const currentMode = getCurrentMode(settings)

  return (
    <section className="settings-screen">
      <div className="hero">
        <div>
          <h2>Configurações</h2>
          <p>Tudo que se ajusta uma vez e depois só funciona.</p>
        </div>
        <div className="hero-card">
          <span>Modo atual</span>
          <strong>{currentMode.short}</strong>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções das configurações">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'settings-nav-btn' + (s.id === current ? ' active' : '')}
              aria-current={s.id === current ? 'page' : undefined}
              onClick={() => setActive(s.id)}
            >
              <span className="settings-nav-icon" aria-hidden="true">
                {s.icon}
              </span>
              <span className="settings-nav-text">
                <strong>{s.label}</strong>
                <span className="muted small">{s.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {current === 'business' && (
            <BusinessSettingsCard notify={notify} tenantNome={tenantNome} />
          )}

          {current === 'menu' && <MenuAdmin {...menuProps} embedded />}

          {current === 'members' && <Members />}

          {current === 'mode' && (
            <>
              <div className="panel settings-panel">
                <div className="panel-title">
                  <h2>Modo de operação</h2>
                  <button type="button" className="btn-ghost small" onClick={onResetSettings}>
                    Restaurar padrão
                  </button>
                </div>
                <div className="current-mode-box">
                  <div>
                    <span className="muted">Modo selecionado</span>
                    <strong>{currentMode.name}</strong>
                    <p className="muted">{currentMode.description}</p>
                    <CloudStatus />
                  </div>
                </div>
              </div>

              <TicketModeCard
                notify={notify}
                onChange={onTicketModeChange}
                vendasNoCaixa={vendasNoCaixa}
              />

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
            </>
          )}

          {current === 'piloto' && <PilotCard notify={notify} contexto={pilotContext} />}

          {current === 'printing' && <PrinterSettingsCard notify={notify} />}

          {!activeSection && (
            <p className="muted">Nenhuma configuração disponível para o seu acesso.</p>
          )}
        </div>
      </div>
    </section>
  )
}
