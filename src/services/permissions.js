// Papeis e permissoes (issue #68).
//
// FONTE UNICA da regra "quem ve o que". Antes esse mapa vivia solto dentro do
// App.jsx; agora a navegacao, as secoes de Configuracoes e a tabela de
// permissoes mostrada ao dono leem todos daqui. Assim o que a tela promete e
// exatamente o que o app faz — nao tem como uma coisa dizer uma e a outra
// fazer outra.
//
// LIMITE DESTA FASE: permissao e por PAPEL (dono/operador), nao por usuario.
// Permissao granular por pessoa depende de backend e entra na fase SaaS
// (epic #26). O papel de cada membro vem do Supabase (tabela `membros`).

export const ROLES = [
  {
    key: 'dono',
    label: 'Dono',
    description: 'Acesso total: opera, fecha o caixa e configura a barraca.',
  },
  {
    key: 'operador',
    label: 'Operador',
    description: 'So o dia a dia do balcao: lanca pedidos e toca a fila.',
  },
]

// Telas da navegacao principal. Configuracoes NAO entra aqui: ela e alcancada
// pela engrenagem do cabecalho, para a barra do balcao ficar so com o que se
// usa de cliente na frente.
export const NAV_SCREENS = [
  { id: 'cashier', label: 'Caixa', roles: ['dono', 'operador'] },
  { id: 'production', label: 'Produção', roles: ['dono', 'operador'] },
  { id: 'closing', label: 'Fechamento', roles: ['dono'] },
]

export const SETTINGS_SCREEN = { id: 'settings', label: 'Configurações', roles: ['dono'] }

export const ALL_SCREENS = [...NAV_SCREENS, SETTINGS_SCREEN]

// Secoes da tela de Configuracoes, na ordem em que aparecem.
//
// Sem `icon` de proposito (#83): cada secao carregava um emoji, e emoji nao e
// icone — muda de desenho a cada sistema, briga com a tipografia e nao ajuda
// ninguem a achar nada. O menu e curto e os rotulos sao claros; texto basta.
// Icone de verdade so entra aqui se um dia existir um jogo de SVG no design
// (hoje o unico e a engrenagem do cabecalho).
export const SETTINGS_SECTIONS = [
  {
    id: 'business',
    label: 'Dados da barraca',
    hint: 'Nome, contato e o que sai no cupom',
    roles: ['dono'],
  },
  {
    id: 'menu',
    label: 'Cardápio',
    hint: 'Itens, preços e o que aparece no caixa',
    roles: ['dono'],
  },
  {
    id: 'members',
    label: 'Membros e permissões',
    hint: 'Quem opera a barraca e o que cada um pode',
    roles: ['dono'],
  },
  {
    id: 'mode',
    label: 'Modo de operação',
    hint: 'Como a barraca trabalha no dia a dia',
    roles: ['dono'],
  },
  {
    id: 'piloto',
    label: 'Piloto',
    hint: 'Anotações do dia e relatório pra enviar',
    roles: ['dono'],
  },
  {
    id: 'printing',
    label: 'Impressão',
    hint: 'Impressora térmica e layout do cupom',
    roles: ['dono'],
  },
]

// O que cada papel pode, em portugues de gente. Serve a tabela de permissoes
// da tela de Membros; cada linha corresponde a uma regra que o app realmente
// aplica (navegacao por papel + acoes das telas).
export const CAPABILITIES = [
  { label: 'Lançar pedido no caixa', dono: true, operador: true },
  { label: 'Informar a senha física entregue', dono: true, operador: true },
  { label: 'Chamar senha e marcar entregue', dono: true, operador: true },
  { label: 'Cancelar pedido', dono: true, operador: true },
  { label: 'Imprimir cupom', dono: true, operador: true },
  { label: 'Ver o fechamento e o faturamento', dono: true, operador: false },
  { label: 'Fechar o caixa do dia', dono: true, operador: false },
  { label: 'Baixar relatório de fechamento', dono: true, operador: false },
  { label: 'Editar cardápio e preços', dono: true, operador: false },
  { label: 'Adicionar e remover membros', dono: true, operador: false },
  { label: 'Mudar modo de operação e impressão', dono: true, operador: false },
]

// role null = modo local sem nuvem (aparelho unico, sem conta): libera tudo,
// porque nao ha login para diferenciar quem esta usando.
export function canAccess(item, role) {
  return role == null || item.roles.includes(role)
}

export function visibleFor(items, role) {
  return items.filter((item) => canAccess(item, role))
}
