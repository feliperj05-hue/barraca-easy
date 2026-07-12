import { useEffect, useState } from 'react'
import { isSupabaseConfigured, checkSupabaseConnection } from '../services/supabaseClient.js'

// Indicador simples do backend de nuvem (Supabase). Alem de informar o status,
// serve para o cliente Supabase ser efetivamente referenciado por codigo
// alcancavel — sem isso o modulo seria removido por tree-shaking e as
// credenciais nao entrariam no bundle publicado (ver #27).
const LABELS = {
  off: 'Nuvem: nao configurada (operando local)',
  checking: 'Nuvem: verificando conexao...',
  ok: 'Nuvem: conectada (Supabase)',
  error: 'Nuvem: indisponivel',
}

export default function CloudStatus() {
  const [status, setStatus] = useState(isSupabaseConfigured ? 'checking' : 'off')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    checkSupabaseConnection().then((res) => {
      if (alive) setStatus(res.ok ? 'ok' : 'error')
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <p className="cloud-status" data-status={status}>
      <span className="cloud-status-dot" aria-hidden="true" />
      {LABELS[status]}
    </p>
  )
}
