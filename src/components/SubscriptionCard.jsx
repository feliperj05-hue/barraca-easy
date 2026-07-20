import { useEffect, useState } from 'react'
import {
  STATUS_LABELS,
  listarMinhasCobrancas,
  diasRestantesDeTeste,
  vagasRestantes,
  cancelarMinhaAssinatura,
  cancelamentoAgendado,
} from '../services/subscriptionService.js'
import CancelSubscriptionDialog from './CancelSubscriptionDialog.jsx'
import { formatBRL } from '../utils/money.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import PlanosCard from './PlanosCard.jsx'

// "Minha assinatura" em Configuracoes (#90).
//
// O dono precisa conseguir responder sozinho tres perguntas: em que situacao
// eu estou, quanto eu pago e o que ja paguei. Sem isso, toda duvida de
// cobranca vira mensagem no WhatsApp do suporte.

const COMP_STATUS = {
  aberta: 'Em aberto',
  paga: 'Paga',
  cancelada: 'Cancelada',
}

function dataBR(iso) {
  if (!iso) return '—'
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

function competenciaBR(iso) {
  if (!iso) return '—'
  const [a, m] = String(iso).slice(0, 10).split('-')
  return `${m}/${a}`
}

export default function SubscriptionCard({ subscription, onContratou, notify }) {
  const [cobrancas, setCobrancas] = useState([])
  const [erro, setErro] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erroCancelar, setErroCancelar] = useState('')

  useEffect(() => {
    let vivo = true
    if (!subscription) return undefined
    listarMinhasCobrancas(subscription.tenant_id)
      .then((c) => vivo && setCobrancas(c))
      .catch(() => vivo && setErro('Não deu para carregar o histórico agora.'))
    return () => {
      vivo = false
    }
  }, [subscription])

  // Dois "sem assinatura" diferentes, e confundir os dois e mentir para o
  // dono. Sem Supabase configurado o aparelho esta mesmo em modo local e nao
  // existe assinatura nenhuma. Ja com a nuvem ligada, `subscription` nulo
  // significa que NAO DEU para saber agora — sinal caiu, ou o servidor ainda
  // nao tem a tabela. Dizer "modo local" nesse caso faria o dono achar que
  // perdeu a conta.
  if (!subscription) {
    return (
      <div className="card">
        <h3>Minha assinatura</h3>
        <p className="muted">
          {isSupabaseConfigured
            ? 'Não deu para consultar a assinatura agora. A barraca continua operando normalmente; tente de novo quando a internet voltar.'
            : 'Este aparelho está no modo local, sem conta na nuvem. Não há assinatura para mostrar.'}
        </p>
      </div>
    )
  }

  const dias = diasRestantesDeTeste(subscription)
  const vagas = vagasRestantes(subscription)
  const jaCancelada = subscription.status_assinatura === 'cancelada'
  const agendado = cancelamentoAgendado(subscription)

  async function confirmarCancelamento(motivo, natureza) {
    setErroCancelar('')
    setCancelando(true)
    try {
      const r = await cancelarMinhaAssinatura(subscription.tenant_id, motivo, natureza)
      setConfirmando(false)
      // Mensagem construida a partir do que o BANCO devolveu, nao do que a
      // tela previu. Se os dois discordarem, quem conta a verdade e o banco.
      if (notify) {
        notify(
          r && r.imediato === false && r.efetivo_em
            ? `Assinatura cancelada. A barraca funciona até ${dataBR(r.efetivo_em)}.`
            : 'Assinatura cancelada.',
        )
      }
      if (onContratou) await onContratou()
    } catch (e) {
      setErroCancelar((e && e.message) || 'Não deu para cancelar agora. Tente de novo.')
    } finally {
      setCancelando(false)
    }
  }

  return (
    <>
      <div className="card assinatura-card">
      <h3>Minha assinatura</h3>

      <dl className="assinatura-dados">
        <div>
          <dt>Situação</dt>
          <dd>
            <span className={`badge status-${subscription.status_assinatura}`}>
              {STATUS_LABELS[subscription.status_assinatura] || subscription.status_assinatura}
            </span>
          </dd>
        </div>
        <div>
          <dt>Plano</dt>
          <dd>{subscription.plano_nome || subscription.plano}</dd>
        </div>
        <div>
          <dt>Usuários</dt>
          <dd>
            {subscription.max_usuarios == null
              ? `${subscription.usuarios_atuais ?? 0} (sem limite)`
              : `${subscription.usuarios_atuais ?? 0} de ${subscription.max_usuarios}`}
          </dd>
        </div>
        <div>
          <dt>Mensalidade</dt>
          <dd>{formatBRL(subscription.valor_mensal)}</dd>
        </div>
        {subscription.status_assinatura === 'teste' ? (
          <div>
            <dt>Teste até</dt>
            <dd>
              {dataBR(subscription.teste_expira_em)}
              {dias != null && dias >= 0 ? ` (${dias} dia${dias === 1 ? '' : 's'})` : ''}
            </dd>
          </div>
        ) : null}
        {subscription.proximo_vencimento ? (
          <div>
            <dt>Próximo vencimento</dt>
            <dd>{dataBR(subscription.proximo_vencimento)}</dd>
          </div>
        ) : null}
      </dl>

      {agendado ? (
        <p className="aviso-cancelamento">
          <strong>Cancelamento pedido.</strong> Sua barraca funciona normalmente até{' '}
          {dataBR(subscription.cancelamento_efetivo_em)}. Depois dessa data o acesso é
          encerrado. Mudou de ideia? É só escolher um plano abaixo.
        </p>
      ) : null}

      {jaCancelada ? (
        <p className="aviso-cancelamento">
          <strong>Assinatura cancelada.</strong> Seu histórico continua salvo. Para voltar a
          usar, escolha um plano abaixo.
        </p>
      ) : null}

      {vagas === 0 ? (
        <p className="muted">
          Todas as vagas de usuário do plano estão em uso. Para incluir mais gente, é preciso
          mudar de plano.
        </p>
      ) : null}

      <h4>Histórico de cobrança</h4>
      {erro ? <p className="muted">{erro}</p> : null}
      {!erro && cobrancas.length === 0 ? (
        <p className="muted">Nenhuma cobrança lançada até agora.</p>
      ) : null}
      {cobrancas.length > 0 ? (
        <table className="tabela-cobrancas">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Situação</th>
              <th>Pago em</th>
            </tr>
          </thead>
          <tbody>
            {cobrancas.map((c) => (
              <tr key={c.id}>
                <td>{competenciaBR(c.competencia)}</td>
                <td>{c.tipo === 'implantacao' ? 'Implantação' : 'Mensalidade'}</td>
                <td>{formatBRL(c.valor)}</td>
                <td>{dataBR(c.vencimento)}</td>
                <td>
                  <span className={`badge cobranca-${c.status}`}>
                    {COMP_STATUS[c.status] || c.status}
                  </span>
                </td>
                <td>{c.pago_em ? dataBR(c.pago_em) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <p className="muted assinatura-rodape">
        O pagamento é feito por Pix e confirmado manualmente pelo suporte. Assim que a baixa é
        dada, a barraca volta a operar automaticamente.
      </p>

      {/* CANCELAMENTO SELF-SERVICE (#115).

          DISCRETO, NAO ESCONDIDO — e a diferenca importa. Ele e um link de
          texto no fim do cartao, sem cor de destaque e sem virar botao grande:
          ninguem cancela sem querer, e nao compete com a escolha de plano.

          Mas ele esta na PRIMEIRA tela onde o dono vem falar de assinatura,
          com o rotulo obvio ("Cancelar assinatura"), a dois toques da tela
          inicial. Sem submenu, sem "area do cliente", sem procurar. Esconder
          para segurar cliente e exatamente o que a regra proibe.

          NAO transforme isto em: link no rodape do site, item de FAQ, "fale
          com o suporte", formulario de pesquisa ou botao que so aparece depois
          do teste acabar. */}
      {!jaCancelada && !agendado ? (
        <p className="assinatura-cancelar">
          <button type="button" className="link-discreto" onClick={() => setConfirmando(true)}>
            Cancelar assinatura
          </button>
        </p>
      ) : null}

      {erroCancelar ? <p className="auth-error">{erroCancelar}</p> : null}
      </div>

      {confirmando ? (
        <CancelSubscriptionDialog
          subscription={subscription}
          busy={cancelando}
          onConfirm={confirmarCancelamento}
          onClose={() => setConfirmando(false)}
        />
      ) : null}

      <PlanosCard subscription={subscription} onContratou={onContratou} notify={notify} />
    </>
  )
}
