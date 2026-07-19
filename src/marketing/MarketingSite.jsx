import { useEffect, useMemo, useState } from 'react'
import { listarPlanosPublicos, listarNovidadesPublicas } from './marketingService.js'
import { mkt, app, MARKETING_BASE, URL_PRIVACIDADE, URL_TERMOS } from '../services/siteConfig.js'
import { rememberSelectedPlan } from '../services/selectedPlan.js'
import './marketing.css'

const iconPaths = {
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  play: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></>,
  cloud: <path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.3 8.4 4.5 4.5 0 0 0 7 18Z"/>,
  devices: <><rect x="3" y="4" width="12" height="16" rx="2"/><path d="M7 17h4M17 8h4v10h-4"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  receipt: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z"/><path d="M9 7h6M9 11h6M9 15h3"/></>,
  production: <><path d="M4 21h16M6 21v-7h12v7M8 14V8a4 4 0 0 1 8 0v6"/><path d="M10 5V2M14 5V2"/></>,
  ticket: <><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z"/><path d="M13 5v14"/></>,
  printer: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  kiosk: <><rect x="7" y="2" width="10" height="16" rx="2"/><path d="M9 22h6M12 18v4M9 5h6M10 9h4M9 13h6"/></>,
  chart: <><path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 5-7"/></>,
  wifi: <><path d="M5 12.55a11 11 0 0 1 14.08 0M8.5 16a6 6 0 0 1 7 0M12 20h.01"/></>,
  store: <><path d="M3 9h18l-2-6H5Z"/><path d="M5 9v12h14V9M9 21v-6h6v6"/></>,
  truck: <><path d="M3 6h11v11H3Z"/><path d="M14 10h4l3 3v4h-7Z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></>,
  event: <><path d="m4 11 8-7 8 7M6 10v10h12V10M9 20v-6h6v6"/><path d="M4 11h16"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
}

function Icon({ name, size = 24, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  )
}

function Logo() {
  return (
    <a className="mk-logo" href={mkt()} aria-label="Barraca Easy — início">
      <span className="mk-logo-mark" aria-hidden="true">
        <span className="mk-awning"><i/><i/><i/><i/></span>
        <span className="mk-shop"><b/></span>
      </span>
      <span className="mk-logo-type"><strong>BARRACA</strong><b>EASY</b></span>
    </a>
  )
}

function Header() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])
  return (
    <header className="mk-header">
      <div className="mk-container mk-header-inner">
        <Logo />
        <button className="mk-menu-button" type="button" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name={open ? 'close' : 'menu'} />
        </button>
        <nav className={'mk-nav ' + (open ? 'is-open' : '')} aria-label="Navegação principal">
          <a href={mkt('#como-funciona')}>Como funciona</a>
          <a href={mkt('#para-quem')}>Para quem é</a>
          <a href={mkt('#recursos')}>Recursos</a>
          <a href={mkt('/precos')}>Planos</a>
          <a href={mkt('/novidades')}>Novidades</a>
          <a href={mkt('#contato')}>Contato</a>
          <div className="mk-nav-actions">
            <a className="mk-button mk-button-ghost" href={app()}>Entrar</a>
            <a className="mk-button mk-button-primary" href={app('?acao=cadastro')}>Testar gratuitamente</a>
          </div>
        </nav>
      </div>
    </header>
  )
}

function PhoneMockup() {
  return (
    <div className="device phone" aria-hidden="true">
      <div className="device-notch" />
      <div className="device-screen">
        <div className="screen-top"><strong>Novo pedido</strong><span>#215</span></div>
        <div className="screen-sub">Mesa / Retirada</div>
        <div className="order-line"><b>1</b><span>X-Burger</span><em>R$ 18,00</em></div>
        <div className="order-line"><b>1</b><span>Batata frita</span><em>R$ 9,00</em></div>
        <div className="order-line"><b>2</b><span>Refrigerante</span><em>R$ 6,00</em></div>
        <div className="screen-note">Observação<br/><strong>Sem cebola</strong></div>
        <div className="screen-total"><span>Total</span><strong>R$ 33,00</strong></div>
        <div className="screen-ticket"><small>Senha</small><b>215</b></div>
        <div className="screen-action">Finalizar pedido</div>
      </div>
    </div>
  )
}

function ProductionMockup() {
  const rows = [
    ['#215', 'X-Burger · Batata · 2x Refri', 'Em preparo'],
    ['#214', 'X-Bacon · Batata', 'Aguardando'],
    ['#213', 'X-Salada · Suco', 'Pronto'],
  ]
  return (
    <div className="device production-device" aria-hidden="true">
      <div className="device-screen">
        <div className="production-head"><strong>Produção</strong><span>●</span></div>
        <div className="production-tabs"><b>Todos (3)</b><span>Aguardando</span><span>Em preparo</span><span>Pronto</span></div>
        {rows.map((row, index) => (
          <div className="production-row" key={row[0]}>
            <strong className={index === 2 ? 'ready' : ''}>{row[0]}</strong>
            <span>{row[1]}</span>
            <em>{row[2]}</em>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardMockup() {
  return (
    <div className="device dashboard-device" aria-hidden="true">
      <div className="device-screen">
        <div className="dashboard-title"><strong>Resumo de vendas</strong><span>Hoje</span></div>
        <div className="metric-row"><div><small>Vendas</small><b>R$ 1.248,00</b></div><div><small>Pedidos</small><b>86</b></div><div><small>Ticket médio</small><b>R$ 14,51</b></div></div>
        <div className="dashboard-grid"><div className="donut"><i/><span>PIX<br/><b>46%</b></span></div><div className="mini-chart"><i/><i/><i/><i/><i/><i/><i/></div></div>
      </div>
    </div>
  )
}

function HeroVisual() {
  return (
    <div className="hero-visual" aria-label="Demonstração do Barraca Easy em celular, produção e painel de vendas">
      <div className="hero-glow" />
      <ProductionMockup />
      <PhoneMockup />
      <DashboardMockup />
      <div className="hero-ticket"><span>Pedido pronto</span><strong>#213</strong></div>
    </div>
  )
}

const operationModes = [
  { icon: 'receipt', title: 'Só no caixa', text: 'Registre pedidos, organize as senhas e acompanhe as vendas em um único dispositivo.', note: 'Ideal para começar simples.' },
  { icon: 'devices', title: 'Caixa conectado à produção', text: 'O caixa lança o pedido e a equipe de preparo acompanha tudo em outra tela.', note: 'Para equipes com duas ou mais pessoas.' },
  { icon: 'ticket', title: 'Senha automática', text: 'O sistema gera a próxima senha no momento do pedido, sem controle manual da sequência.', note: 'Mais agilidade no caixa.' },
  { icon: 'printer', title: 'Senha com impressão térmica', text: 'Imprima a senha do cliente ou uma via para apoiar a produção e a conferência.', note: 'Requer equipamento compatível.' },
  { icon: 'edit', title: 'Senha manual', text: 'Continue usando fichas, cartões, pager ou a sequência própria que sua operação já conhece.', note: 'Mude sem abandonar seu método.' },
]

const flow = [
  { n: '1', title: 'O caixa registra', text: 'Produtos, quantidades, pagamento, observações e senha em poucos passos.', view: 'phone' },
  { n: '2', title: 'A produção recebe', text: 'Os pedidos aparecem organizados para orientar o preparo.', view: 'production' },
  { n: '3', title: 'A equipe atualiza', text: 'Acompanhe o que está aguardando, em preparo ou pronto.', view: 'status' },
  { n: '4', title: 'O responsável confere', text: 'Vendas e formas de pagamento reunidas para o fechamento.', view: 'dashboard' },
]

const scenarios = [
  { icon: 'store', title: 'Barracas e trailers', text: 'Organize pedidos e senhas nos horários de maior movimento.' },
  { icon: 'truck', title: 'Food trucks', text: 'Mantenha caixa e produção no mesmo fluxo usando celular ou tablet.' },
  { icon: 'event', title: 'Feiras e eventos', text: 'Prepare uma equipe temporária para poucas horas de muito movimento.' },
  { icon: 'store', title: 'Quiosques e pontos fixos', text: 'Mais controle da rotina sem a complexidade de um sistema grande.' },
]

const resources = [
  { icon: 'receipt', title: 'Pedidos e atendimento', text: 'Produtos, quantidades, observações, pagamentos e senhas.' },
  { icon: 'production', title: 'Produção', text: 'Fila de pedidos organizada até a entrega.' },
  { icon: 'chart', title: 'Gestão', text: 'Fechamentos, resultados e exportação de informações.' },
  { icon: 'devices', title: 'Mobilidade', text: 'Use no navegador ou instale no celular como aplicativo.' },
  { icon: 'wifi', title: 'Internet instável', text: 'Identifique pendências e sincronize quando a conexão retornar.' },
]

function FeatureThumb({ type }) {
  if (type === 'production') return <div className="flow-thumb production-thumb"><span>#215</span><i/><span>#214</span><i/><span>#213</span></div>
  if (type === 'status') return <div className="flow-thumb status-thumb"><span>● Aguardando</span><span>● Em preparo</span><span>● Pronto</span></div>
  if (type === 'dashboard') return <div className="flow-thumb chart-thumb"><div className="mini-bars"><i/><i/><i/><i/><i/></div><strong>R$ 1.248</strong></div>
  return <div className="flow-thumb phone-thumb"><div className="tiny-phone"><span>Pedido #215</span><i/><i/><i/><b>Finalizar</b></div></div>
}

function PlanCards({ compact = false }) {
  const [planos, setPlanos] = useState([])
  const [state, setState] = useState('loading')
  useEffect(() => {
    let active = true
    listarPlanosPublicos()
      .then((data) => { if (active) { setPlanos(data); setState('ready') } })
      .catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [])

  if (state === 'loading') return <div className="plan-loading">Carregando planos...</div>
  if (state === 'error') return <div className="plan-loading">Os valores serão exibidos assim que o catálogo público estiver disponível.</div>
  if (!planos.length) return <div className="plan-loading">Novos planos serão publicados em breve.</div>

  return (
    <div className={'plan-grid ' + (compact ? 'is-compact' : '')}>
      {planos.map((p, index) => (
        <article className={'plan-card ' + (index === 1 ? 'is-featured' : '')} key={p.codigo}>
          {index === 1 && <span className="plan-badge">Mais indicado para começar</span>}
          <p className="eyebrow">{p.nome}</p>
          <h3>{p.descricao_comercial || p.descricao}</h3>
          <div className="plan-price"><strong>{Number(p.valor_mensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><span>/mês</span></div>
          <ul>
            <li><Icon name="check" size={17}/> Até {p.max_usuarios} {p.max_usuarios === 1 ? 'usuário' : 'usuários'}</li>
            <li><Icon name="check" size={17}/> 7 dias de teste gratuito</li>
            {Number(p.taxa_implantacao) > 0 && <li><Icon name="check" size={17}/> Implantação assistida</li>}
          </ul>
          <a className={'mk-button ' + (index === 1 ? 'mk-button-primary' : 'mk-button-outline')} href={app(`?acao=cadastro&plano=${encodeURIComponent(p.codigo)}`)} onClick={() => rememberSelectedPlan(p.codigo)}>Testar este plano <Icon name="arrow" size={18}/></a>
        </article>
      ))}
    </div>
  )
}

function UpdatesPreview({ limit = 3 }) {
  const [updates, setUpdates] = useState([])
  useEffect(() => {
    let active = true
    listarNovidadesPublicas(limit).then((data) => active && setUpdates(data)).catch(() => {})
    return () => { active = false }
  }, [limit])
  const list = updates.length ? updates : [
    { slug: 'pedidos-mais-claros', categoria: 'Melhoria', titulo: 'Pedidos mais claros para a produção', resumo: 'Informações organizadas para facilitar a leitura dos itens, observações e andamento.' },
    { slug: 'internet-instavel', categoria: 'Melhoria', titulo: 'Mais clareza durante oscilações de internet', resumo: 'Identificação mais simples do que já foi sincronizado e do que ainda está aguardando.' },
    { slug: 'atendimento-automatico', categoria: 'Em breve', titulo: 'Atendimento mais automático', resumo: 'Novas formas de reduzir etapas no atendimento e integrar pedidos à produção.' },
  ]
  return (
    <div className="updates-grid">
      {list.map((item) => (
        <article className="update-card" key={item.slug || item.titulo}>
          <span>{item.categoria}</span>
          <h3>{item.titulo}</h3>
          <p>{item.resumo}</p>
        </article>
      ))}
    </div>
  )
}

function HomePage() {
  return (
    <>
      <section className="mk-hero">
        <div className="mk-container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow pill">Feito para barracas, trailers e pequenos negócios de alimentação</p>
            <h1>Sua operação organizada do <em>pedido ao fechamento.</em></h1>
            <p className="hero-lead">Registre pedidos, envie as informações para a produção, acompanhe as senhas e confira suas vendas em um sistema simples de usar.</p>
            <div className="hero-actions">
              <a className="mk-button mk-button-primary mk-button-large" href={app('?acao=cadastro')}>Testar gratuitamente <Icon name="arrow" size={20}/></a>
              <a className="mk-button mk-button-outline mk-button-large" href="#como-funciona"><Icon name="play" size={20}/> Ver como funciona</a>
            </div>
            <p className="hero-note"><span>✓</span> 7 dias para conhecer o Barraca Easy. Sem compromisso.</p>
          </div>
          <HeroVisual />
        </div>
        <div className="mk-container trust-strip">
          <div><Icon name="cloud"/><span><strong>Online e offline</strong><small>Apoio durante oscilações</small></span></div>
          <div><Icon name="devices"/><span><strong>Em diferentes dispositivos</strong><small>Celular, tablet ou computador</small></span></div>
          <div><Icon name="users"/><span><strong>Caixa, produção e gestão</strong><small>Acessos conforme a operação</small></span></div>
          <div><Icon name="lock"/><span><strong>Controles de acesso</strong><small>Informações separadas por barraca</small></span></div>
        </div>
      </section>

      <section className="mk-section operation-section" id="modos">
        <div className="mk-container">
          <div className="section-heading wide-heading">
            <div><p className="eyebrow">Flexibilidade de operação</p><h2>Escolha como sua operação vai funcionar.</h2><p>Comece somente com o caixa e adicione produção, impressão e novos recursos conforme o movimento aumentar.</p></div>
          </div>
          <div className="mode-layout">
            <div className="mode-grid">
              {operationModes.map((mode, index) => (
                <article className="mode-card" key={mode.title}>
                  <span className="mode-number">{index + 1}</span>
                  <div className="mode-icon"><Icon name={mode.icon}/></div>
                  <h3>{mode.title}</h3>
                  <p>{mode.text}</p>
                  <small>{mode.note}</small>
                </article>
              ))}
            </div>
            <article className="future-card">
              <span className="future-badge">Em desenvolvimento</span>
              <span className="mode-number">6</span>
              <div className="kiosk-visual"><Icon name="kiosk" size={64}/><b>215</b></div>
              <h3>Atendimento 100% automatizado com totem</h3>
              <p>O cliente faz o pedido no totem e a produção recebe tudo no mesmo fluxo.</p>
              <a href="#lancamento">Acompanhar lançamento <Icon name="arrow" size={18}/></a>
            </article>
          </div>
          <div className="evolution-line"><span>Comece com o caixa</span><i/><span>Conecte a produção</span><i/><span>Imprima e organize senhas</span><i className="dashed"/><span>Evolua para o autoatendimento</span></div>
        </div>
      </section>

      <section className="mk-section flow-section" id="como-funciona">
        <div className="mk-container">
          <div className="section-heading"><div><p className="eyebrow">Como funciona</p><h2>Um fluxo simples para toda a equipe.</h2><p>Cada pessoa acompanha a informação necessária para realizar seu trabalho.</p></div><a className="mk-text-link" href={mkt('#modos')}>Ver modos de operação <Icon name="arrow" size={18}/></a></div>
          <div className="flow-grid">
            {flow.map((item, index) => (
              <article className="flow-card" key={item.n}>
                <div className="flow-title"><span>{item.n}</span><h3>{item.title}</h3></div>
                <FeatureThumb type={item.view}/>
                <p>{item.text}</p>
                {index < flow.length - 1 && <div className="flow-arrow"><Icon name="arrow"/></div>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section scenarios-section" id="para-quem">
        <div className="mk-container">
          <div className="section-heading"><div><p className="eyebrow">Para quem é</p><h2>Feito para diferentes negócios e momentos.</h2></div></div>
          <div className="scenario-grid">
            {scenarios.map((item, index) => (
              <article className={'scenario-card scenario-' + (index + 1)} key={item.title}>
                <div className="scenario-art"><Icon name={item.icon} size={44}/><span>{index === 0 ? 'BARRACA' : index === 1 ? 'FOOD TRUCK' : index === 2 ? 'EVENTO' : 'QUIOSQUE'}</span></div>
                <div><h3>{item.title}</h3><p>{item.text}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section resources-section" id="recursos">
        <div className="mk-container">
          <div className="section-heading"><div><p className="eyebrow">Recursos disponíveis</p><h2>O que você já pode usar no Barraca Easy.</h2></div></div>
          <div className="resource-grid">
            {resources.map((item) => <article key={item.title}><Icon name={item.icon}/><h3>{item.title}</h3><p>{item.text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="mk-section future-section" id="lancamento">
        <div className="mk-container future-panel">
          <div><p className="eyebrow light">Em desenvolvimento</p><h2>O próximo passo: atendimento ainda mais automático.</h2><p>Estamos preparando o autoatendimento por totem para reduzir etapas no caixa e enviar pedidos diretamente para a produção.</p><small>Funcionalidades, equipamentos compatíveis e formas de pagamento serão divulgados após validação.</small></div>
          <div className="launch-form">
            <strong>Quer acompanhar o desenvolvimento?</strong>
            <p>As etapas validadas e os primeiros testes serão publicados na área de novidades.</p>
            <a className="mk-button mk-button-primary" href={mkt('/novidades')}>Acompanhar novidades <Icon name="arrow" size={18}/></a>
          </div>
        </div>
      </section>

      <section className="mk-section plans-section" id="planos">
        <div className="mk-container">
          <div className="section-heading center-heading"><div><p className="eyebrow">Planos</p><h2>Escolha o plano adequado para sua operação.</h2><p>Todos incluem 7 dias de teste gratuito.</p></div></div>
          <PlanCards compact />
          <div className="center-action"><a className="mk-text-link" href={mkt('/precos')}>Comparar todos os planos <Icon name="arrow" size={18}/></a></div>
        </div>
      </section>

      <section className="mk-section updates-section" id="novidades">
        <div className="mk-container">
          <div className="section-heading"><div><p className="eyebrow">Novidades</p><h2>O Barraca Easy está sempre evoluindo.</h2><p>Melhorias explicadas pelo que muda na sua rotina, sem linguagem técnica.</p></div><a className="mk-text-link" href={mkt('/novidades')}>Ver todas <Icon name="arrow" size={18}/></a></div>
          <UpdatesPreview />
        </div>
      </section>

      <section className="mk-section faq-section">
        <div className="mk-container faq-grid">
          <div><p className="eyebrow">Dúvidas frequentes</p><h2>Comece sabendo o essencial.</h2><p>O Barraca Easy pode ser acessado no navegador, instalado como aplicativo e usado em dispositivos compatíveis.</p></div>
          <div className="faq-list">
            <details><summary>Posso usar só no caixa?</summary><p>Sim. Você pode começar em um único dispositivo e conectar uma tela de produção quando precisar.</p></details>
            <details><summary>Posso trabalhar com senha manual?</summary><p>Sim. O sistema aceita a senha informada pela equipe, além da geração automática.</p></details>
            <details><summary>Funciona com impressora térmica?</summary><p>Sim, quando o equipamento e a configuração forem compatíveis.</p></details>
            <details><summary>O totem já está disponível?</summary><p>Ainda não. O atendimento automatizado está em desenvolvimento e será liberado após testes.</p></details>
          </div>
        </div>
      </section>

      <section className="mk-cta" id="contato">
        <div className="mk-container cta-panel">
          <div><p className="eyebrow light">Comece agora</p><h2>Organize sua operação antes do próximo horário de pico.</h2><p>Crie sua conta, cadastre sua barraca e conheça o sistema durante 7 dias.</p></div>
          <div className="cta-actions"><a className="mk-button mk-button-primary mk-button-large" href={app('?acao=cadastro')}>Testar gratuitamente <Icon name="arrow" size={20}/></a><a className="mk-button mk-button-dark-outline" href={mkt('/precos')}>Conhecer os planos</a></div>
        </div>
      </section>
    </>
  )
}

function PricesPage() {
  return (
    <main className="mk-inner-page">
      <section className="inner-hero"><div className="mk-container"><p className="eyebrow pill">Planos simples e transparentes</p><h1>Comece com o que sua operação precisa hoje.</h1><p>Escolha pelo tamanho da equipe. Você poderá mudar de plano conforme o movimento crescer.</p></div></section>
      <section className="mk-section"><div className="mk-container"><PlanCards /></div></section>
      <section className="mk-section comparison-note"><div className="mk-container"><h2>Como a contratação funciona</h2><div className="three-steps"><div><b>1</b><h3>Escolha o plano</h3><p>O plano fica lembrado durante o cadastro.</p></div><div><b>2</b><h3>Crie a conta e a barraca</h3><p>O plano pertence à operação, não apenas à pessoa.</p></div><div><b>3</b><h3>Conclua a contratação</h3><p>O pagamento é processado em ambiente seguro do provedor escolhido.</p></div></div></div></section>
    </main>
  )
}

function UpdatesPage() {
  return (
    <main className="mk-inner-page">
      <section className="inner-hero"><div className="mk-container"><p className="eyebrow pill">Novidades do Barraca Easy</p><h1>Melhorias explicadas de um jeito simples.</h1><p>Acompanhe o que mudou, como isso ajuda sua operação e o que está sendo preparado.</p></div></section>
      <section className="mk-section"><div className="mk-container"><UpdatesPreview limit={20}/></div></section>
    </main>
  )
}

function Footer() {
  return (
    <footer className="mk-footer">
      <div className="mk-container footer-grid">
        <div className="footer-brand"><Logo/><p>Sistema simples para organizar pedidos, produção, senhas e fechamento em pequenos negócios de alimentação.</p></div>
        <div><h3>Produto</h3><a href={mkt('#como-funciona')}>Como funciona</a><a href={mkt('#recursos')}>Recursos</a><a href={mkt('/precos')}>Planos</a><a href={mkt('/novidades')}>Novidades</a></div>
        <div><h3>Para seu negócio</h3><a href={mkt('#para-quem')}>Barracas e trailers</a><a href={mkt('#para-quem')}>Food trucks</a><a href={mkt('#para-quem')}>Feiras e eventos</a><a href={mkt('#para-quem')}>Quiosques</a></div>
        <div><h3>Suporte</h3><a href={mkt('#contato')}>Contato</a><a href={mkt('#contato')}>Perguntas frequentes</a><a href={URL_PRIVACIDADE}>Privacidade</a><a href={URL_TERMOS}>Termos de uso</a></div>
      </div>
      <div className="mk-container footer-bottom"><span>© 2026 Barraca Easy. Todos os direitos reservados.</span><span>Feito para quem vive a operação.</span></div>
    </footer>
  )
}

export default function MarketingSite() {
  // Rota interna e relativa ao prefixo do site comercial (services/siteConfig).
  // Privacidade e termos NAO passam por aqui: apontam para o site estatico
  // (#107), que ja tem o texto juridico de verdade.
  const path = useMemo(() => {
    const limpo = window.location.pathname.replace(/\/+$/, '') || '/'
    const semBase = limpo.startsWith(MARKETING_BASE)
      ? limpo.slice(MARKETING_BASE.length)
      : limpo
    return semBase || '/'
  }, [])
  let page = <HomePage />
  if (path === '/precos') page = <PricesPage />
  else if (path === '/novidades') page = <UpdatesPage />
  return <div className="marketing"><Header />{page}<Footer /></div>
}
