import { useCallback, useEffect, useState } from 'react'
import {
  listarBarracas,
  listarCobrancas,
  listarPlanos,
  contratarPlano,
  estenderTeste,
  definirStatus,
  gerarCobranca,
  baixarCobranca,
  cancelarCobranca,
} from '../services/adminService.js'
import { STATUS_LABELS } from '../services/subscriptionService.js'
import { formatBRL } from '../utils/money.js'

// Painel de administracao da plataforma (#91).
//
// Mora dentro do proprio app de proposito: um painel separado seria outro
// deploy, outro build e outra conta para manter. Aqui e uma tela a mais,
// escondida de quem nao e admin e barrada no banco de qualquer jeito —
// custo fixo zero, que e a restricao da frente inteira.
//
// Fluxo do dinheiro hoje e manual e assumido como tal: o Pix cai na conta do
// Felipe por fora, ele confirma aqui e o acesso da barraca acompanha. O
// gancho para gateway existe (`cobrancas.referencia_externa`), mas so faz
// sentido quando houver volume que pague a taxa.

const STATUS = ['teste', 'ativa', 'suspensa', 'cancelada']

const COBRANCA_STATUS = {
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

export default function Admin({ notify }) {
  const [barracas, setBarracas] = useState([])
  const [cobrancas, setCobrancas] = useState([])
  const [planos, setPlanos] = useState([])
  const [selecionada, setSelecionada] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const lista = await listarBarracas()
      setBarracas(lista)
      const todas = await listarCobrancas(null)
      setCobrancas(todas)
      setPlanos(await listarPlanos())
    } catch (e) {
      setErro(e.message || 'Não deu para carregar o painel.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const aviso = useCallback(
    (msg) => {
      if (notify) notify(msg)
    },
    [notify],
  )

  async function acao(fn, sucesso) {
    try {
      await fn()
      aviso(sucesso)
      await recarregar()
    } catch (e) {
      aviso(e.message || 'Não deu certo.')
    }
  }

  const atual = barracas.find((b) => b.id === selecionada) || null
  const cobrancasDaAtual = atual ? cobrancas.filter((c) => c.tenant_id === atual.id) : []

  // Numeros do topo: o que o Felipe quer saber em tres segundos.
  const ativas = barracas.filter((b) => b.status_assinatura === 'ativa').length
  const emTeste = barracas.filter((b) => b.status_assinatura === 'teste').length
  const emAberto = cobrancas
    .filter((c) => c.status === 'aberta')
    .reduce((s, c) => s + Number(c.valor || 0), 0)
  const receitaMes = barracas
    .filter((b) => b.status_assinatura === 'ativa')
    .reduce((s, b) => s + Number(b.valor_mensal || 0), 0)

  if (carregando) return <p className="muted">Carregando o painel...</p>
  if (erro) return <p className="muted">{erro}</p>

  return (
    <section className="admin-screen">
      <div className="hero">
        <div>
          <h2>Clientes</h2>
          <p>Barracas assinantes, acessos e pagamentos.</p>
        </div>
      </div>

      <div className="admin-resumo">
        <div className="admin-kpi">
          <span>Ativas</span>
          <strong>{ativas}</strong>
        </div>
        <div className="admin-kpi">
          <span>Em teste</span>
          <strong>{emTeste}</strong>
        </div>
        <div className="admin-kpi">
          <span>Receita/mês</span>
          <strong>{formatBRL(receitaMes)}</strong>
        </div>
        <div className="admin-kpi">
          <span>Em aberto</span>
          <strong>{formatBRL(emAberto)}</strong>
        </div>
      </div>

      <div className="card">
        <h3>Barracas</h3>
        {barracas.length === 0 ? <p className="muted">Nenhuma barraca cadastrada ainda.</p> : null}
        {barracas.length > 0 ? (
          <table className="tabela-cobrancas">
            <thead>
              <tr>
                <th>Barraca</th>
                <th>Situação</th>
                <th>Plano</th>
                <th>Mensalidade</th>
                <th>Usuários</th>
                <th>Pedidos</th>
                <th>Último pedido</th>
                <th>Em aberto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {barracas.map((b) => (
                <tr key={b.id} className={b.id === selecionada ? 'linha-ativa' : undefined}>
                  <td>{b.nome}</td>
                  <td>
                    <span className={`badge status-${b.status_assinatura}`}>
                      {STATUS_LABELS[b.status_assinatura] || b.status_assinatura}
                    </span>
                    {b.status_assinatura === 'teste' && b.teste_expira_em ? (
                      <span className="muted"> até {dataBR(b.teste_expira_em)}</span>
                    ) : null}
                  </td>
                  <td>{b.plano_nome || b.plano}</td>
                  <td>{formatBRL(b.valor_mensal)}</td>
                  <td>
                    {b.max_usuarios == null
                      ? `${b.usuarios_atuais} (sem limite)`
                      : `${b.usuarios_atuais} / ${b.max_usuarios}`}
                    {b.max_usuarios != null && b.usuarios_atuais > b.max_usuarios ? (
                      <strong className="admin-excedente"> acima do plano</strong>
                    ) : null}
                  </td>
                  <td>{b.pedidos_total}</td>
                  <td>{b.ultimo_pedido ? dataBR(b.ultimo_pedido) : '—'}</td>
                  <td>
                    {b.cobrancas_abertas > 0 ? (
                      <strong>{formatBRL(b.valor_em_aberto)}</strong>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setSelecionada(b.id === selecionada ? null : b.id)}
                    >
                      {b.id === selecionada ? 'Fechar' : 'Gerenciar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {atual ? (
        <BarracaDetalhe
          barraca={atual}
          cobrancas={cobrancasDaAtual}
          planos={planos}
          onAcao={acao}
        />
      ) : null}
    </section>
  )
}

function BarracaDetalhe({ barraca, cobrancas, planos, onAcao }) {
  const [valor, setValor] = useState(String(barraca.valor_mensal ?? ''))
  const [plano, setPlano] = useState(barraca.plano || '')
  const [obs, setObs] = useState('')

  useEffect(() => {
    setValor(String(barraca.valor_mensal ?? ''))
    setPlano(barraca.plano || '')
    setObs('')
  }, [barraca])

  const abertas = cobrancas.filter((c) => c.status === 'aberta')

  return (
    <div className="card admin-detalhe">
      <h3>{barraca.nome}</h3>

      <div className="admin-bloco">
        <h4>Plano</h4>
        <p className="muted">
          O limite de usuários do plano vale no banco: a barraca não consegue passar dele nem
          chamando a API direto.
        </p>

        <div className="admin-planos">
          {planos
            .filter((p) => p.contratavel || p.codigo === barraca.plano)
            .map((p) => {
              const atual = p.codigo === barraca.plano
              const naoCabe =
                p.max_usuarios != null && barraca.usuarios_atuais > p.max_usuarios
              return (
                <label
                  key={p.codigo}
                  className={`admin-plano${atual ? ' admin-plano-atual' : ''}`}
                >
                  <input
                    type="radio"
                    name="plano"
                    value={p.codigo}
                    checked={plano === p.codigo}
                    onChange={() => setPlano(p.codigo)}
                  />
                  <span className="admin-plano-nome">{p.nome}</span>
                  <span className="muted">{p.descricao}</span>
                  <span className="admin-plano-preco">{formatBRL(p.valor_mensal)}/mês</span>
                  {Number(p.taxa_implantacao) > 0 ? (
                    <span className="muted">
                      + {formatBRL(p.taxa_implantacao)} de implantação (uma vez)
                    </span>
                  ) : null}
                  {naoCabe ? (
                    <span className="admin-excedente">
                      A barraca tem {barraca.usuarios_atuais} usuários. Ninguém é removido, mas
                      não entra gente nova até baixar para {p.max_usuarios}.
                    </span>
                  ) : null}
                </label>
              )
            })}
        </div>

        <button
          type="button"
          className="btn-primary"
          disabled={!plano || plano === barraca.plano}
          onClick={() =>
            onAcao(async () => {
              const r = await contratarPlano(barraca.id, plano)
              if (r && r.excedente > 0) {
                throw new Error(
                  `Plano trocado. Atenção: a barraca tem ${r.usuarios_atuais} usuários e o plano permite ${r.max_usuarios}. Ninguém foi removido, mas não entra gente nova até baixar.`,
                )
              }
            }, 'Plano contratado.')
          }
        >
          Contratar plano selecionado
        </button>
      </div>

      <div className="admin-bloco">
        <h4>Acesso</h4>
        <p className="muted">
          Suspensa e cancelada não lançam pedido — o bloqueio é do banco, não só da tela.
        </p>
        <div className="admin-status-botoes">
          {[7, 15, 30].map((d) => (
            <button
              key={d}
              type="button"
              className="btn-ghost"
              onClick={() =>
                onAcao(
                  () => estenderTeste(barraca.id, d),
                  `Teste estendido em ${d} dias.`,
                )
              }
            >
              +{d} dias de teste
            </button>
          ))}
        </div>

        <div className="admin-status-botoes">
          {STATUS.map((s) => (
            <button
              key={s}
              type="button"
              className={s === barraca.status_assinatura ? 'btn-primary' : 'btn-ghost'}
              disabled={s === barraca.status_assinatura}
              onClick={() =>
                onAcao(
                  () =>
                    definirStatus(barraca.id, s, {
                      valorMensal: valor === '' ? null : Number(valor),
                      observacao: obs || null,
                    }),
                  `Barraca marcada como ${STATUS_LABELS[s] || s}.`,
                )
              }
            >
              {STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>

        <div className="admin-campos">
          <label>
            Mensalidade (R$)
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <label className="admin-campo-largo">
            Observação
            <input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Fica registrado junto da mudança"
            />
          </label>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            onAcao(
              () =>
                definirStatus(barraca.id, barraca.status_assinatura, {
                  valorMensal: valor === '' ? null : Number(valor),
                  observacao: obs || null,
                }),
              'Dados salvos.',
            )
          }
        >
          Salvar valor e observação
        </button>
      </div>

      <div className="admin-bloco">
        <h4>Pagamentos</h4>
        <p className="muted">
          O Pix cai por fora; a baixa aqui é a confirmação. Quando não sobra nada em aberto, a
          barraca volta a operar sozinha.
        </p>
        <div className="admin-acoes-linha">
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              onAcao(() => gerarCobranca(barraca.id), 'Cobrança do mês gerada.')
            }
          >
            Gerar cobrança do mês
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              onAcao(
                () => gerarCobranca(barraca.id, { tipo: 'implantacao' }),
                'Taxa de implantação lançada.',
              )
            }
          >
            Lançar taxa de implantação
          </button>
        </div>

        {abertas.length === 0 ? <p className="muted">Nada em aberto.</p> : null}

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
                <th />
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
                      {COBRANCA_STATUS[c.status] || c.status}
                    </span>
                  </td>
                  <td>{c.pago_em ? dataBR(c.pago_em) : '—'}</td>
                  <td className="admin-acoes-linha">
                    {c.status === 'aberta' ? (
                      <>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() =>
                            onAcao(
                              () => baixarCobranca(c.id),
                              'Pagamento confirmado. Acesso liberado.',
                            )
                          }
                        >
                          Recebi o Pix
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() =>
                            onAcao(() => cancelarCobranca(c.id), 'Cobrança cancelada.')
                          }
                        >
                          Cancelar
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  )
}
