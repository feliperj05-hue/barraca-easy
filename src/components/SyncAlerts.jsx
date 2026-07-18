import { useCallback, useEffect, useState } from 'react'
import { incidentAll, incidentDelete } from '../services/offlineDb.js'

// Avisos de sincronizacao que o operador PRECISA ver (#59).
//
// Nao e toast: toast some sozinho e some justo quando a barraca esta cheia.
// Aqui e modal, bloqueia a tela e so sai com confirmacao — porque a acao e no
// mundo real: o cliente esta segurando um papel com a senha antiga, e alguem
// tem que ir la avisar.
//
// Os incidentes vivem no IndexedDB, entao um reload (ou fechar o app) nao
// apaga o aviso: ele volta na proxima abertura ate alguem dar ciencia.

function Reassigned({ item }) {
  return (
    <>
      <p className="sync-alert-lead">
        A senha <strong>{item.from}</strong> já tinha sido usada hoje em outro aparelho.
      </p>
      <p className="sync-alert-big">
        O pedido agora é a senha <strong>{item.to}</strong>
      </p>
      <p className="sync-alert-action">
        Avise o cliente que está com o papel da senha {item.from}: a senha dele agora é a{' '}
        {item.to}. A venda foi salva e está na fila da produção.
      </p>
    </>
  )
}

function Failed({ item }) {
  const isSale = item.opType === 'create'
  return (
    <>
      <p className="sync-alert-lead">
        {isSale
          ? 'Uma venda feita sem conexão não pôde ser enviada.'
          : 'Uma alteração de pedido não pôde ser enviada.'}
      </p>
      {item.ticket && (
        <p className="sync-alert-big">
          Senha <strong>{item.ticket}</strong>
        </p>
      )}
      <p className="sync-alert-action">
        {isSale
          ? 'Confira com o cliente e, se a venda não estiver na fila, lance o pedido de novo.'
          : 'Confira o pedido na tela de Produção e refaça a ação se precisar.'}
      </p>
      {item.reason && <p className="sync-alert-reason">Detalhe técnico: {item.reason}</p>}
    </>
  )
}

export default function SyncAlerts() {
  const [items, setItems] = useState([])

  const reload = useCallback(() => {
    incidentAll()
      .then(setItems)
      .catch(() => {})
  }, [])

  useEffect(() => {
    reload()
    // O sync avisa quando mexeu em alguma coisa; ai reconferimos os registros.
    window.addEventListener('barraca:synced', reload)
    return () => window.removeEventListener('barraca:synced', reload)
  }, [reload])

  const current = items[0]
  if (!current) return null

  const acknowledge = async () => {
    await incidentDelete(current.seq)
    reload()
  }

  const isReassign = current.type === 'ticket-reassigned'

  return (
    <div className="modal-backdrop sync-alert-backdrop">
      <div className="modal sync-alert" role="alertdialog" aria-modal="true">
        <h2 className={isReassign ? 'sync-alert-title' : 'sync-alert-title danger'}>
          {isReassign ? 'Senha trocada — avise o cliente' : 'Atenção: venda não enviada'}
        </h2>
        {isReassign ? <Reassigned item={current} /> : <Failed item={current} />}
        {items.length > 1 && (
          <p className="sync-alert-more">+ {items.length - 1} aviso(s) depois deste</p>
        )}
        <button type="button" className="btn-primary sync-alert-ok" onClick={acknowledge}>
          Entendi, já avisei
        </button>
      </div>
    </div>
  )
}
