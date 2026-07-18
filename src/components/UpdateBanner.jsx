import { useEffect, useState } from 'react'
import { onUpdateReady, applyUpdate } from '../services/pwa.js'

// Aviso de versao nova (#56).
//
// O app NUNCA se atualiza sozinho: o carrinho do caixa e um pedido em
// digitacao, e recarregar no meio disso e perder venda com fila na frente.
// Entao a versao nova fica esperando aqui e o operador aperta quando a fila
// deixar. Faixa discreta no rodape — informa sem atrapalhar a operacao.
export default function UpdateBanner() {
  const [ready, setReady] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => onUpdateReady(() => setReady(true)), [])

  if (!ready) return null

  return (
    <div className="update-banner" role="status">
      <span className="update-banner-text">Nova versão do app disponível</span>
      <button
        type="button"
        className="btn-primary update-banner-btn"
        disabled={applying}
        onClick={() => {
          setApplying(true)
          applyUpdate()
        }}
      >
        {applying ? 'Atualizando...' : 'Atualizar agora'}
      </button>
    </div>
  )
}
