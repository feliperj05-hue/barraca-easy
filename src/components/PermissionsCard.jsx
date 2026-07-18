import { ROLES, CAPABILITIES } from '../services/permissions.js'

// Tabela de permissoes por papel (issue #68).
//
// So mostra, nao edita — e de proposito. As permissoes sao FIXAS por papel
// nesta fase, e uma tela que finge deixar editar o que o app nao aplica seria
// pior que nao ter tela nenhuma. O que se escolhe de verdade e o papel de cada
// membro, logo acima.
export default function PermissionsCard() {
  return (
    <div className="panel settings-panel">
      <div className="panel-title">
        <h2>O que cada papel pode fazer</h2>
      </div>

      <div className="role-legend">
        {ROLES.map((r) => (
          <div key={r.key} className="role-legend-item">
            <span className={'member-badge ' + r.key}>{r.label}</span>
            <span className="muted small">{r.description}</span>
          </div>
        ))}
      </div>

      <div className="perm-table" role="table">
        <div className="perm-row perm-head" role="row">
          <span role="columnheader">Ação</span>
          <span role="columnheader">Dono</span>
          <span role="columnheader">Operador</span>
        </div>
        {CAPABILITIES.map((cap) => (
          <div className="perm-row" role="row" key={cap.label}>
            <span role="cell">{cap.label}</span>
            <span role="cell" className={cap.dono ? 'perm-yes' : 'perm-no'}>
              {cap.dono ? '✓' : '—'}
            </span>
            <span role="cell" className={cap.operador ? 'perm-yes' : 'perm-no'}>
              {cap.operador ? '✓' : '—'}
            </span>
          </div>
        ))}
      </div>

      <p className="settings-note">
        As permissões são fixas por papel nesta versão — você escolhe o papel de
        cada membro, não item por item. Permissão por pessoa depende do plano em
        nuvem e vem numa fase seguinte.
      </p>
    </div>
  )
}
