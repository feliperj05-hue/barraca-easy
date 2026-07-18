import { useEffect, useMemo, useState } from 'react'
import {
  getPrinterSettings,
  savePrinterSettings,
  isWebUsbSupported,
  unsupportedReason,
  getKnownPrinter,
  requestPrinter,
  describeDevice,
  buildReceiptOutput,
  printOrder,
} from '../services/printerService.js'
import { sampleOrder } from '../services/receiptLayout.js'

// Configuracao da impressora termica (issue #63).
//
// Tudo aqui foi feito para funcionar SEM impressora na mesa: o preview mostra
// o cupom exatamente com as colunas que vao sair no papel, e o dump mostra os
// bytes ESC/POS. Da para fechar o layout antes de comprar o hardware.
export default function PrinterSettingsCard({ notify }) {
  const [settings, setSettings] = useState(() => getPrinterSettings())
  const [device, setDevice] = useState(null)
  const [showBytes, setShowBytes] = useState(false)
  const supported = isWebUsbSupported()
  const reason = supported ? null : unsupportedReason()

  // Impressora ja autorizada em outro dia continua valendo: o navegador
  // guarda a permissao, entao a barraca nao repareia toda manha.
  useEffect(() => {
    let active = true
    if (!supported) return undefined
    getKnownPrinter()
      .then((d) => {
        if (active) setDevice(d)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [supported])

  const preview = useMemo(() => buildReceiptOutput(sampleOrder(), settings), [settings])

  function update(patch) {
    setSettings(savePrinterSettings(patch))
  }

  async function connect() {
    try {
      const d = await requestPrinter()
      setDevice(d)
      notify('Impressora conectada: ' + (d.productName || 'USB'))
    } catch (err) {
      // Cancelar o seletor do Chrome tambem cai aqui; nao e erro de verdade.
      notify(err?.message || 'Nenhuma impressora selecionada.')
    }
  }

  async function testPrint() {
    const result = await printOrder(sampleOrder(), settings)
    notify(result.printed ? 'Cupom de teste enviado.' : result.reason)
  }

  return (
    <div className="panel printer-panel">
      <div className="panel-title">
        <h2>Impressora térmica</h2>
        <span className={'printer-badge' + (device ? ' ok' : '')}>
          {device ? 'Conectada' : 'Sem impressora'}
        </span>
      </div>

      {!supported && <p className="printer-warning">{reason}</p>}

      {supported && (
        <p className="muted">
          {device
            ? describeDevice(device)
            : 'Ligue a impressora no cabo USB/OTG do tablet e toque em Conectar.'}
        </p>
      )}

      <div className="printer-actions">
        <button type="button" className="btn-secondary" onClick={connect} disabled={!supported}>
          Conectar impressora
        </button>
        <button type="button" className="btn-ghost" onClick={testPrint} disabled={!supported}>
          Imprimir cupom de teste
        </button>
      </div>

      <label className="printer-toggle">
        <input
          type="checkbox"
          checked={Boolean(settings.enabled)}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        <span>Imprimir cupom automaticamente ao confirmar o pagamento</span>
      </label>

      <div className="printer-grid">
        <div className="field">
          <label htmlFor="printer-width">Largura do papel</label>
          <select
            id="printer-width"
            value={settings.paperWidth}
            onChange={(e) => update({ paperWidth: Number(e.target.value) })}
          >
            <option value={58}>58 mm (32 colunas)</option>
            <option value={80}>80 mm (48 colunas)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="printer-encoding">Acentuação</label>
          <select
            id="printer-encoding"
            value={settings.encoding}
            onChange={(e) => update({ encoding: e.target.value })}
          >
            <option value="cp850">Com acento (CP850)</option>
            <option value="ascii">Sem acento (à prova de bala)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="printer-copies">Vias</label>
          <select
            id="printer-copies"
            value={settings.copies}
            onChange={(e) => update({ copies: Number(e.target.value) })}
          >
            <option value={1}>1 via</option>
            <option value={2}>2 vias</option>
            <option value={3}>3 vias</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="printer-header">Cabeçalho</label>
          <input
            id="printer-header"
            value={settings.header}
            maxLength={40}
            onChange={(e) => update({ header: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="printer-footer">Rodapé</label>
          <input
            id="printer-footer"
            value={settings.footer}
            maxLength={60}
            onChange={(e) => update({ footer: e.target.value })}
          />
        </div>
      </div>

      <div className="printer-checks">
        <label>
          <input
            type="checkbox"
            checked={settings.showItems !== false}
            onChange={(e) => update({ showItems: e.target.checked })}
          />
          <span>Listar os itens do pedido</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.cut !== false}
            onChange={(e) => update({ cut: e.target.checked })}
          />
          <span>Cortar o papel no fim</span>
        </label>
      </div>

      <div className="panel-title">
        <h3>Prévia do cupom</h3>
        <button
          type="button"
          className="btn-ghost small"
          onClick={() => setShowBytes((v) => !v)}
        >
          {showBytes ? 'Ver cupom' : 'Ver bytes ESC/POS'}
        </button>
      </div>
      <pre className={'receipt-preview' + (showBytes ? ' bytes' : '')}>
        {showBytes ? preview.hex : preview.text}
      </pre>
      <p className="muted small">
        {showBytes
          ? preview.bytes.length + ' bytes enviados à impressora.'
          : 'É exatamente assim que o cupom sai no papel, coluna por coluna.'}
      </p>
    </div>
  )
}
