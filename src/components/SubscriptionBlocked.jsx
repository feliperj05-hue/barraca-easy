import { useEffect, useState } from 'react'
import DevFeedbackButton from './DevFeedbackButton.jsx'
import {
  motivoBloqueio,
  listarMinhasCobrancas,
  STATUS_LABELS,
} from '../services/subscriptionService.js'
import { formatBRL } from '../utils/money.js'

// Tela de barraca bloqueada por assinatura (#90).
//
// Duas coisas que ela NAO faz de proposito:
//
// 1. Nao esconde o historico. Quem esta com pagamento em aberto ainda precisa
//    ver o que deve e conferir o fechamento do que ja vendeu. Bloqueio aqui e
//    "nao vende mais ate acertar", nao "perdi tudo" — a RLS do #89 tambem
//    separa assim: suspensa le, so nao escreve.
// 2. Nao inventa chave Pix nem telefone. O contato sai de variavel de
//    ambiente (`VITE_PIX_CHAVE`, `VITE_SUPORTE_CONTATO`); enquanto nao
//    estiverem configuradas, a tela manda falar com o suporte pelo botao que
//    o app ja tem. Chumbar um dado de cobranca errado no bundle seria pior
//    que nao mostrar nada.
const PIX_CHAVE = import.meta.env.VITE_PIX_CHAVE || ''
const SUPORTE = import.meta.env.VITE_SUPORTE_CONTATO || ''

function dataBR(iso) {
  if (!iso) return '—'
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export default function SubscriptionBlocked({ subscription, onRecheck, role }) {
  const motivo = motivoBloqueio(subscription)
  const [cobrancas, setCobrancas] = useState([])
  const [checando, setChecando] = useState(false)

  useEffect(() => {
    let vivo = true
    if (role !== 'dono' || !subscription) return undefined
    listarMinhasCobrancas(subscription.tenant_id)
      .then((c) => {
        if (vivo) setCobrancas(c)
      })
      .catch(() => {
        /* sem rede: a tela vale sem a lista */
      })
    return () => {
      vivo = false
    }
  }, [subscription, role])

  const abertas = cobrancas.filter((c) => c.status === 'aberta')
  const total = abertas.reduce((s, c) => s + Number(c.valor || 0), 0)

  async function recheck() {
    setChecando(true)
    try {
      await onRecheck()
    } finally {
      setChecando(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card bloqueio-card">
        <div className="auth-brand">
          <div className="logo">B</div>
          <h1>Barraca Easy</h1>
        </div>

        <h2 className="bloqueio-titulo">{motivo ? motivo.titulo : 'Acesso indisponível'}</h2>
        <p className="bloqueio-texto">{motivo ? motivo.texto : ''}</p>

        {subscription ? (
          <p className="muted">
            {subscription.nome} · {STATUS_LABELS[subscription.status_assinatura] || '—'}
          </p>
        ) : null}

        {role === 'dono' && abertas.length > 0 ? (
          <div className="bloqueio-cobrancas">
            <h3>Em aberto</h3>
            <ul>
              {abertas.map((c) => (
                <li key={c.id}>
                  <span>{dataBR(c.competencia).slice(3)}</span>
                  <strong>{formatBRL(c.valor)}</strong>
                  <span className="muted">vence {dataBR(c.vencimento)}</span>
                </li>
              ))}
            </ul>
            <p className="bloqueio-total">
              Total: <strong>{formatBRL(total)}</strong>
            </p>
          </div>
        ) : null}

        {role === 'dono' && PIX_CHAVE ? (
          <div className="bloqueio-pix">
            <h3>Pagar por Pix</h3>
            <p className="muted">Use a chave abaixo e avise o suporte para liberar na hora.</p>
            <code className="pix-chave">{PIX_CHAVE}</code>
          </div>
        ) : null}

        {SUPORTE ? <p className="muted">Suporte: {SUPORTE}</p> : null}

        <button type="button" className="btn-primary" onClick={recheck} disabled={checando}>
          {checando ? 'Verificando...' : 'Já paguei, verificar agora'}
        </button>

        <DevFeedbackButton tela="assinatura-bloqueada" />
      </div>
    </div>
  )
}
