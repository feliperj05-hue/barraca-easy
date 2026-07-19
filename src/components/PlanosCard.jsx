import { useEffect, useState } from 'react'
import {
  listarPlanosDisponiveis,
  contratarPlano,
  lerDadosPix,
  diasRestantesDeTeste,
} from '../services/subscriptionService.js'
import { formatBRL } from '../utils/money.js'
import { clearSelectedPlan, readSelectedPlan } from '../services/selectedPlan.js'

// Escolha de plano pelo proprio dono (#96).
//
// O ponto do requisito: o dono contrata SOZINHO, a qualquer momento, sem
// esperar o teste acabar e sem falar com o Felipe antes.
//
// O que "contratar" significa aqui, e a tela precisa ser honesta sobre isso:
// e MANIFESTACAO DE INTERESSE. O clique troca o plano e deixa a cobranca em
// aberto — nao cobra nada sozinho e nao ativa a assinatura. O pagamento e Pix
// por fora e quem confirma o recebimento e uma pessoa. Prometer "assinatura
// ativa" no clique seria mentira, e o cliente descobriria do pior jeito.
export default function PlanosCard({ subscription, onContratou, notify }) {
  const [planos, setPlanos] = useState([])
  const [pix, setPix] = useState(null)
  const [preselecionado] = useState(() => readSelectedPlan())
  const [busy, setBusy] = useState('')
  const [erro, setErro] = useState('')
  const [escolhido, setEscolhido] = useState(null)

  useEffect(() => {
    let vivo = true
    listarPlanosDisponiveis()
      .then((p) => vivo && setPlanos(p))
      .catch(() => vivo && setErro('Não deu para carregar os planos agora.'))
    lerDadosPix().then((d) => vivo && setPix(d))
    return () => {
      vivo = false
    }
  }, [])

  if (!subscription) return null

  const dias = diasRestantesDeTeste(subscription)
  const emTeste = subscription.status_assinatura === 'teste'

  async function escolher(codigo) {
    setErro('')
    setBusy(codigo)
    try {
      const r = await contratarPlano(subscription.tenant_id, codigo)
      setEscolhido(r)
      // O plano vindo do site comercial ja cumpriu o papel: some com ele para
      // o app nao reabrir em Minha assinatura no proximo login (#111).
      clearSelectedPlan()
      if (notify) notify('Plano escolhido. Agora é só pagar por Pix.')
      if (onContratou) await onContratou()
    } catch (e) {
      setErro((e && e.message) || 'Não deu para trocar de plano.')
    } finally {
      setBusy('')
    }
  }

  const chave = pix && pix.pix_chave

  return (
    <div className="card planos-card">
      <h3>Planos</h3>

      {emTeste ? (
        <p className="muted">
          {dias != null && dias >= 0
            ? `Você está em período de teste — faltam ${dias} dia(s).`
            : 'Seu período de teste terminou.'}{' '}
          Pode escolher um plano quando quiser, sem esperar o teste acabar.
        </p>
      ) : (
        <p className="muted">Plano atual: {subscription.plano_nome || subscription.plano}.</p>
      )}

      {erro ? <p className="auth-error">{erro}</p> : null}

      <div className="planos-lista">
        {planos.map((p) => {
          const atual = p.codigo === subscription.plano
          return (
            <div key={p.codigo} className={'plano-item' + (atual ? ' plano-atual' : '') + (preselecionado === p.codigo ? ' plano-preselecionado' : '')}>
              <div className="plano-cabeca">
                <strong>{p.nome}</strong>
                <span className="plano-valor">{formatBRL(p.valor_mensal)}/mês</span>
              </div>
              <p className="muted">{p.descricao}</p>
              {Number(p.taxa_implantacao) > 0 ? (
                <p className="muted">
                  + {formatBRL(p.taxa_implantacao)} de implantação, cobrado uma única vez.
                </p>
              ) : null}
              <button
                type="button"
                className={atual ? 'btn-ghost' : 'btn-primary'}
                disabled={atual || busy === p.codigo}
                onClick={() => escolher(p.codigo)}
              >
                {atual ? 'Plano atual' : busy === p.codigo ? 'Escolhendo...' : preselecionado === p.codigo ? 'Confirmar plano escolhido' : 'Escolher este'}
              </button>
            </div>
          )
        })}
      </div>

      {escolhido ? (
        <div className="plano-escolhido">
          <h4>Como pagar</h4>
          <p>
            Valor: <strong>{formatBRL(escolhido.valor_cobrado)}</strong>
            {escolhido.setup_gerado
              ? ' (mais a taxa de implantação, lançada à parte)'
              : ''}
            .
          </p>
          {chave ? (
            <>
              <p className="muted">Pague por Pix para a chave abaixo:</p>
              <code className="pix-chave">{chave}</code>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(chave)
                    if (notify) notify('Chave Pix copiada.')
                  }
                }}
              >
                Copiar chave
              </button>
            </>
          ) : (
            <p className="muted">
              Fale com o suporte para receber os dados de pagamento.
            </p>
          )}
          <p className="muted">
            A confirmação do pagamento é feita manualmente pelo suporte. Assim que ela sair, a
            barraca fica ativa — escolher o plano aqui ainda não libera a assinatura.
          </p>
        </div>
      ) : null}
    </div>
  )
}
