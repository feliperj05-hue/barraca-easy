import { useState } from 'react'
import { getBusiness, saveBusiness, resetBusiness } from '../services/businessService.js'

// Dados da barraca (issue #68).
//
// Salva com botao explicito, e nao a cada tecla: no tablet do balcao o dono
// costuma preencher isso com a mao suja e o dedo grosso, e um "salvo!" piscando
// a cada letra so atrapalha. Um botao, um toast, acabou.
export default function BusinessSettingsCard({ notify, tenantNome }) {
  const [form, setForm] = useState(() => getBusiness())
  const [dirty, setDirty] = useState(false)

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
  }

  function handleSave(e) {
    e.preventDefault()
    saveBusiness(form)
    setDirty(false)
    notify('Dados da barraca salvos.')
  }

  function handleReset() {
    if (!window.confirm('Limpar os dados da barraca deste aparelho?')) return
    setForm(resetBusiness())
    setDirty(false)
    notify('Dados da barraca limpos.')
  }

  return (
    <form className="panel settings-panel" onSubmit={handleSave}>
      <div className="panel-title">
        <h2>Dados da barraca</h2>
        {dirty && <span className="settings-badge warn">Nao salvo</span>}
      </div>

      <p className="muted">
        Identificacao do negocio. O nome e a mensagem vao para o cupom impresso.
      </p>

      <div className="settings-grid-fields">
        <div className="field">
          <label htmlFor="biz-name">Nome da barraca</label>
          <input
            id="biz-name"
            value={form.name}
            maxLength={40}
            placeholder="Barraca do Seu Ze"
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="biz-phone">Telefone / WhatsApp</label>
          <input
            id="biz-phone"
            value={form.phone}
            maxLength={20}
            inputMode="tel"
            placeholder="(85) 90000-0000"
            onChange={(e) => update({ phone: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="biz-doc">CNPJ / CPF (opcional)</label>
          <input
            id="biz-doc"
            value={form.document}
            maxLength={20}
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            onChange={(e) => update({ document: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="biz-address">Endereco / ponto</label>
          <input
            id="biz-address"
            value={form.address}
            maxLength={60}
            placeholder="Praia de Iracema, barraca 12"
            onChange={(e) => update({ address: e.target.value })}
          />
        </div>

        <div className="field field-wide">
          <label htmlFor="biz-msg">Mensagem no cupom</label>
          <input
            id="biz-msg"
            value={form.receiptMessage}
            maxLength={60}
            placeholder="Obrigado e volte sempre!"
            onChange={(e) => update({ receiptMessage: e.target.value })}
          />
          <p className="muted small">
            Sai no rodape do cupom. So substitui o rodape atual se ele ainda
            estiver no texto padrao — se voce escreveu um rodape proprio na
            secao Impressao, ele continua valendo.
          </p>
        </div>
      </div>

      <div className="settings-actions">
        <button type="submit" className="btn-primary" disabled={!dirty}>
          Salvar dados
        </button>
        <button type="button" className="btn-ghost" onClick={handleReset}>
          Limpar
        </button>
      </div>

      <p className="settings-note">
        <strong>Vale so neste aparelho.</strong> Estes dados ficam guardados no
        tablet, entao cada aparelho tem a sua copia — preencha em cada um.
        {tenantNome && (
          <>
            {' '}
            O nome da conta na nuvem (<strong>{tenantNome}</strong>) e outra
            coisa e continua valendo para a equipe toda.
          </>
        )}
      </p>
    </form>
  )
}
