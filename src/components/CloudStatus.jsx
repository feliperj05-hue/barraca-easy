import { useEffect, useState } from 'react'
import { isSupabaseConfigured, checkSupabaseConnection } from '../services/supabaseClient.js'
import { subscribeNetStatus } from '../services/netStatus.js'

// Diagnostico da nuvem na tela de Configuracoes.
//
// Antes ele checava a conexao UMA vez, ao montar, e nunca mais: se o sinal
// caisse depois, seguia exibindo "conectada" — mentira exatamente na hora em
// que o operador precisaria da verdade (#59b). Agora a checagem inicial serve
// so de partida e o estado passa a acompanhar o resultado real das chamadas
// (netStatus), igual ao selo do cabecalho.
//
// Tambem serve para o cliente Supabase ser referenciado por codigo alcancavel
// — sem isso o modulo sairia no tree-shaking e as credenciais nao entrariam no
// bundle publicado (ver #27).
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

  useEffect(() => {
    if (!isSupabaseConfigured) return
    return subscribeNetStatus((s) => setStatus(s.online ? 'ok' : 'error'))
  }, [])

  return (
    <p className="cloud-status" data-status={status}>
      <span className="cloud-status-dot" aria-hidden="true" />
      {LABELS[status]}
    </p>
  )
}
