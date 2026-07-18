#!/usr/bin/env python3
"""Parte 2 da identidade visual — issue #71: shell, cards e estados."""
import re
import sys

CAMINHO = '/home/barracadev/barraca-easy-repo/src/styles/app.css'
with open(CAMINHO, encoding='utf-8') as f:
    css = f.read()

erros = []


def troca(antigo, novo, rotulo):
    global css
    n = css.count(antigo)
    if n != 1:
        erros.append(f'{rotulo}: esperava 1 ocorrencia, achei {n}')
        return
    css = css.replace(antigo, novo)


# --- Fundo do app: chapado. Gradiente de tela inteira e repaint caro
#     no scroll de tablet de entrada, e nao acrescenta nada. -------------
troca('''  background: linear-gradient(135deg, #fff8ef, #fff0dc);
  color: var(--cor-texto);''',
      '''  background: var(--cor-fundo);
  color: var(--cor-texto);''', 'body background')

# --- Cabecalho carvao ------------------------------------------------
# A barra escura faz tres coisas: separa navegacao de conteudo sem
# precisar de sombra, aguenta sol batendo (11:1 de contraste) e tira o
# laranja do topo, que era metade da cara "infantil" da versao antiga.
troca('''  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--cor-borda);''',
      '''  background: var(--cor-nav);
  color: var(--cor-texto-invertido);
  border-bottom: 1px solid var(--cor-nav-linha);''', 'app-header')

troca('''.logo {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: var(--cor-acao);
  color: white;
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(255, 138, 0, 0.28);
}''',
      '''.logo {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: var(--cor-acao);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 24px;
  font-weight: 900;
  flex: none;
}''', 'logo')

troca('''.brand-sub {
  color: var(--cor-texto-suave);
  font-size: 14px;
  margin-top: 4px;
}''',
      '''.brand-sub {
  color: var(--cor-nav-texto);
  font-size: 13px;
  margin-top: 3px;
}

/* Abas na barra escura. A aba ativa vira papel solido: o operador
   enxerga de longe em que tela esta, mesmo de relance. */
.nav-btn {
  background: transparent;
  color: var(--cor-nav-texto);
  border: 1px solid var(--cor-nav-linha);
  min-height: 48px;
}

.nav-btn:hover {
  background: rgba(255, 250, 242, 0.10);
}

.active-tab {
  background: var(--cor-superficie);
  color: var(--cor-texto);
  border-color: var(--cor-superficie);
}

.app-header .btn-ghost {
  background: transparent;
  border: 1px solid var(--cor-nav-linha);
  color: var(--cor-texto-invertido);
}

.app-header .account-info {
  color: var(--cor-nav-texto);
}

.app-header .account-role {
  color: var(--cor-texto-invertido);
}''', 'brand-sub + nav')

# --- Botao padrao: neutro. Antes todo botao nascia laranja claro, o que
#     espalhava a cor de acao pela tela inteira. ----------------------
troca('''  color: var(--cor-texto);
  background: var(--cor-acao-tint);
  transition: transform 0.08s ease, opacity 0.08s ease;''',
      '''  color: var(--cor-texto);
  background: var(--cor-superficie-2);
  border: 1px solid var(--cor-borda);
  transition: background 0.12s ease, opacity 0.12s ease;''', 'button padrao')

# Botao nao pula mais ao toque: em tablet o :hover fica grudado depois do
# toque e a grade inteira parecia tremer.
troca('''button:hover {
  transform: translateY(-1px);
}

button:active {
  transform: translateY(1px);
  opacity: 0.85;
}''',
      '''button:active {
  opacity: 0.82;
}''', 'button hover/active')

# --- Hero: era um bloco de marketing comendo a dobra da tela do Caixa.
#     Vira uma faixa fina de contexto. --------------------------------
troca('''  border-radius: 30px;
  padding: 28px;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 22px;
  align-items: center;
  margin-bottom: 24px;
}''',
      '''  border-radius: var(--radius-lg);
  padding: 18px 22px;
  display: grid;
  grid-template-columns: 1.4fr 0.6fr;
  gap: 18px;
  align-items: center;
  margin-bottom: 18px;
}''', 'hero')

troca('''.hero h2 {
  font-size: clamp(28px, 4.4vw, 48px);
  line-height: 0.98;
  letter-spacing: -1.4px;
  margin-bottom: 14px;
}

.hero p {
  color: var(--cor-texto-suave);
  font-size: 20px;
  line-height: 1.45;
}''',
      '''.hero h2 {
  font-size: clamp(22px, 2.6vw, 30px);
  line-height: 1.05;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
}

.hero p {
  color: var(--cor-texto-suave);
  font-size: 16px;
  line-height: 1.4;
}''', 'hero texto')

troca('''.hero-card {
  background: linear-gradient(135deg, var(--cor-acao), #ffba5b);
  border-radius: 28px;
  color: white;
  padding: 28px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.hero-card strong {
  font-size: 56px;
  line-height: 1;
}

.hero-card span {
  font-size: 18px;
  font-weight: 800;
  opacity: 0.95;
}''',
      '''.hero-card {
  background: var(--cor-nav);
  border-radius: var(--radius);
  color: var(--cor-texto-invertido);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.hero-card strong {
  font-size: 22px;
  line-height: 1;
  letter-spacing: -0.5px;
}

.hero-card span {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--cor-nav-texto);
}''', 'hero-card')

# --- Cartao de produto ------------------------------------------------
troca('''.product {
  border: 1px solid var(--cor-borda);
  border-radius: 20px;
  background: var(--cor-superficie-2);
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 164px;
  justify-content: space-between;
}''',
      '''.product {
  border: 1px solid var(--cor-borda);
  border-radius: var(--radius);
  background: var(--cor-superficie);
  padding: 14px;
  display: flex;
  flex-direction: column;
  min-height: 168px;
  justify-content: space-between;
  gap: 10px;
}''', 'product')

troca('''.price {
  color: var(--cor-texto);
  font-size: 22px;
  font-weight: 900;
}''',
      '''.price {
  color: var(--cor-texto);
  font-size: 23px;
  font-weight: 900;
  letter-spacing: -0.5px;
}''', 'price')

# --- Selo de senha na Producao: e a informacao mais lida do app.
#     Carvao da 11:1 contra o laranja com 3.2:1. ----------------------
troca('''.ticket-badge {
  background: var(--cor-acao);
  color: white;''',
      '''.ticket-badge {
  background: var(--cor-nav);
  color: var(--cor-texto-invertido);''', 'ticket-badge')

# Status padrao (aguardando) deixa de ser laranja: laranja e acao.
troca('''  font-weight: 900;
  background: var(--cor-acao-tint);
  color: var(--cor-acao-texto);
}

.status.done {''',
      '''  font-weight: 900;
  background: var(--cor-superficie-2);
  color: var(--cor-texto-suave);
  border: 1px solid var(--cor-borda);
}

.status.done {''', 'status padrao')

troca('''.status.called {
  background: var(--cor-atencao-tint);
  color: var(--cor-atencao-texto);
}''',
      '''.status.called {
  background: var(--cor-atencao-tint);
  color: var(--cor-atencao-texto);
  border-color: var(--cor-acento-suave);
}''', 'status.called')

# --- Metricas do dia --------------------------------------------------
troca('''.metric {
  background: var(--cor-superficie);
  border: 1px solid var(--cor-borda);
  border-radius: 22px;
  padding: 20px;
  box-shadow: var(--sombra);
}''',
      '''.metric {
  background: var(--cor-superficie);
  border: 1px solid var(--cor-borda);
  border-radius: var(--radius);
  padding: 16px 18px;
  box-shadow: none;
}''', 'metric')

troca('''.metric strong {
  display: block;
  font-size: 30px;
  margin-top: 8px;
}''',
      '''.metric strong {
  display: block;
  font-size: 28px;
  margin-top: 6px;
  letter-spacing: -0.6px;
}''', 'metric strong')

# --- Selo de conexao: mora na barra escura, precisa de variante propria.
#     Verde aqui e legitimo — e status. -------------------------------
troca('''.conn-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--cor-acao-tint);
  font-weight: 800;
  font-size: 15px;
  white-space: nowrap;
}''',
      '''.conn-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 250, 242, 0.10);
  border: 1px solid var(--cor-nav-linha);
  color: var(--cor-texto-invertido);
  font-weight: 800;
  font-size: 14px;
  white-space: nowrap;
}''', 'conn-status')

troca('''.conn-status[data-state='ok'] .conn-dot {
  background: var(--cor-status-ok);
}''',
      '''.conn-status[data-state='ok'] {
  background: rgba(72, 142, 66, 0.22);
  border-color: rgba(127, 177, 124, 0.55);
}

.conn-status[data-state='ok'] .conn-dot {
  background: #7fb17c;
}''', 'conn ok')

troca('''.conn-status[data-state='offline'] {
  background: var(--cor-perigo-tint);
  color: var(--cor-perigo);
}''',
      '''.conn-status[data-state='offline'] {
  background: rgba(192, 57, 43, 0.26);
  border-color: rgba(192, 57, 43, 0.5);
  color: #ffd9d3;
}''', 'conn offline')

troca('''.conn-status[data-state='offline'] .conn-dot {
  background: var(--cor-perigo);
}''',
      '''.conn-status[data-state='offline'] .conn-dot {
  background: #ff8a7a;
}''', 'conn offline dot')

troca('''.conn-pending {
  padding-left: 10px;
  border-left: 2px solid rgba(45, 33, 24, 0.15);
  font-weight: 900;
}''',
      '''.conn-pending {
  padding-left: 10px;
  border-left: 2px solid var(--cor-nav-linha);
  font-weight: 900;
}''', 'conn-pending')

# --- Paineis: sombra curta -------------------------------------------
troca('''.panel {
  background: var(--cor-superficie);
  border: 1px solid var(--cor-borda);
  border-radius: var(--radius);
  box-shadow: var(--sombra);
  padding: 20px;
}''',
      '''.panel {
  background: var(--cor-superficie);
  border: 1px solid var(--cor-borda);
  border-radius: var(--radius-lg);
  box-shadow: var(--sombra);
  padding: 20px;
}''', 'panel')

# --- Navegacao das Configuracoes: alinhar ao resto -------------------
troca('''.settings-nav-btn.active {
  border-color: var(--cor-status-ok-texto);
  background: var(--cor-status-ok-tint);
}''',
      '''.settings-nav-btn.active {
  border-color: var(--cor-nav);
  background: var(--cor-nav);
  color: var(--cor-texto-invertido);
}''', 'settings-nav ativo')

# --- Tela de login: usava um cinza-azulado de dashboard generico -----
troca('''.auth-tab.active {
  background: var(--cor-texto);
  color: #fff;
}''',
      '''.auth-tab.active {
  background: var(--cor-nav);
  color: var(--cor-texto-invertido);
}''', 'auth-tab')

# --- backdrop-filter restante ----------------------------------------
if 'backdrop-filter' in css:
    erros.append('sobrou backdrop-filter: ' + str(css.count('backdrop-filter')))

with open(CAMINHO, 'w', encoding='utf-8') as f:
    f.write(css)

if erros:
    print('ERROS:')
    for e in erros:
        print(' -', e)
    sys.exit(1)
print('OK parte 2.')
