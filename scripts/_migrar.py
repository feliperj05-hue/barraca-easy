#!/usr/bin/env python3
"""Migracao da identidade visual do Barraca Easy — issue #71."""
import re
import sys

CAMINHO = '/home/barracadev/barraca-easy-repo/src/styles/app.css'

with open(CAMINHO, encoding='utf-8') as f:
    css = f.read()

erros = []


def troca(antigo, novo, esperado=None, rotulo=''):
    global css
    n = css.count(antigo)
    if esperado is not None and n != esperado:
        erros.append(f'{rotulo or antigo!r}: esperava {esperado}, achei {n}')
        return
    if n == 0:
        erros.append(f'{rotulo or antigo!r}: nao encontrado')
        return
    css = css.replace(antigo, novo)


# ------------------------------------------------------------------
# 1. Bloco de tokens
# ------------------------------------------------------------------
NOVO_ROOT = '''/* ============================================================
   Identidade visual (issue #71)
   ============================================================
   Tokens nomeados por FUNCAO, nao por cor. Dois motivos:

   1. Se a marca mudar de tom, muda aqui e o resto do arquivo continua
      correto — ninguem sai cacando "#f45f0d" em 1700 linhas.
   2. A regra de negocio da cor fica escrita no nome. "Verde so e status"
      deixa de depender da memoria de quem mexer depois: quem quiser um
      botao verde generico nao acha token pra isso.

   Todo par cor/fundo foi medido contra WCAG AA por `npm run contraste`
   (scripts/contraste.mjs). Nao troque um valor sem rodar o script — o
   tablet fica no balcao pegando sol, contraste aqui e operacional. */
:root {
  /* --- Superficies --------------------------------------------- */
  --cor-fundo: #eae1d3;         /* areia: fundo do app */
  --cor-superficie: #fffaf2;    /* papel: cartoes e paineis */
  --cor-superficie-2: #f6efe3;  /* papel rebaixado: item dentro de cartao */
  --cor-borda: #ddd1bd;
  --cor-borda-forte: #c7b9a2;

  /* --- Texto ---------------------------------------------------- */
  --cor-texto: #3c3835;         /* carvao: 8.9:1 na areia, 11.2:1 no papel */
  --cor-texto-suave: #5c5b53;   /* 5.3:1 na areia */
  --cor-texto-invertido: #fffaf2;

  /* --- Navegacao (barra carvao) --------------------------------- */
  --cor-nav: #3c3835;
  --cor-nav-texto: rgba(255, 250, 242, 0.78);
  --cor-nav-linha: rgba(255, 250, 242, 0.16);

  /* --- Acao primaria: laranja forte, SO em CTA ------------------ */
  --cor-acao: #f45f0d;          /* fundo de botao. Branco em cima da 3.24:1,
                                   valido so para texto grande em negrito */
  --cor-acao-pressionado: #d24f08;
  --cor-acao-texto: #9a4413;    /* laranja como TEXTO: 5.1:1 na areia */
  --cor-acao-tint: #fbe6d6;     /* fundo de selo/selecao laranja */

  /* --- Acento institucional: preenchimento e borda, nunca texto -- */
  --cor-institucional: #ca6129;
  --cor-acento-suave: #e9a475;

  /* --- Status positivo: verde e SO status ----------------------- */
  --cor-status-ok: #488e42;        /* bolinha e preenchimento */
  --cor-status-ok-texto: #3d5337;  /* 6.5:1 na areia, 8.1:1 no papel */
  --cor-status-ok-tint: #e3efe1;

  /* --- Atencao e erro ------------------------------------------- */
  --cor-atencao-texto: #7a5200;
  --cor-atencao-tint: #fbeecd;
  --cor-perigo: #c0392b;
  --cor-perigo-tint: #fbe9e7;

  /* --- Cinza quente: borda, icone decorativo, desabilitado.
         NUNCA como cor de texto sobre fundo claro (da 2.7:1). ----- */
  --cor-cinza: #8a8a81;

  /* --- Elevacao -------------------------------------------------
     Sombra curta de proposito. O alvo e tablet Android de entrada:
     sombra grande e backdrop-filter custam repaint caro no scroll da
     grade de produtos, justo a tela que mais rola. */
  --sombra: 0 2px 6px rgba(60, 56, 53, 0.10);
  --sombra-alta: 0 8px 20px rgba(60, 56, 53, 0.16);
  --radius: 18px;
  --radius-lg: 22px;
}'''

antigo_root = css[: css.index('}') + 1]
if '--primary: #ff8a00' not in antigo_root:
    erros.append('bloco :root nao localizado como esperado')
else:
    css = NOVO_ROOT + css[css.index('}') + 1 :]

# ------------------------------------------------------------------
# 2. Casos que precisam de decisao antes da troca cega
# ------------------------------------------------------------------

# .price: verde nao e preco. Preco e informacao, vai em carvao.
troca('''.price {
  color: var(--secondary);''', '''.price {
  color: var(--cor-texto);''', 1, '.price')

troca('''  text-align: center;
  color: var(--secondary);
  background: #fff;''', '''  text-align: center;
  color: var(--cor-texto);
  background: var(--cor-superficie);''', 1, '.price-input')

# Aba de categoria selecionada: carvao, nao verde (nao e status).
troca('''.category-btn.selected {
  background: var(--secondary);
  color: white;
  border-color: var(--secondary);
}''', '''.category-btn.selected {
  background: var(--cor-nav);
  color: var(--cor-texto-invertido);
  border-color: var(--cor-nav);
}''', 1, '.category-btn.selected')

# Forma de pagamento escolhida: selecao, nao sucesso. Tint laranja.
troca('''.payment-grid button.selected {
  background: var(--secondary);
  color: #fff;
}''', '''.payment-grid button.selected {
  background: var(--cor-acao-tint);
  border-color: var(--cor-acento-suave);
  color: var(--cor-acao-texto);
}''', 1, '.payment-grid selected')

# Modo escolhido nas Configuracoes: selecao, nao status.
troca('''.mode-card.selected {
  border-color: var(--secondary);
  box-shadow: 0 18px 38px rgba(31, 138, 112, 0.16);
}''', '''.mode-card.selected {
  border-color: var(--cor-acao);
  box-shadow: var(--sombra-alta);
}''', 1, '.mode-card.selected')

troca('''.mode-card.selected .mode-number {
  background: var(--secondary);
  color: #fff;
}''', '''.mode-card.selected .mode-number {
  background: var(--cor-acao);
  color: #fff;
}''', 1, '.mode-number selecionado')

# Status "entregue" e "modo pronto": verde legitimo.
troca('''.status.done {
  background: #e9f8f3;
  color: var(--secondary);
}''', '''.status.done {
  background: var(--cor-status-ok-tint);
  color: var(--cor-status-ok-texto);
}''', 1, '.status.done')

troca('''.mode-status.ready {
  background: #e9f8f3;
  color: var(--secondary);
}''', '''.mode-status.ready {
  background: var(--cor-status-ok-tint);
  color: var(--cor-status-ok-texto);
}''', 1, '.mode-status.ready')

# Item ativo no cardapio: estado positivo ligado, verde legitimo.
troca('''.toggle-btn.on {
  border-color: var(--secondary);
  background: #e7f5f0;
  color: var(--secondary);
}''', '''.toggle-btn.on {
  border-color: var(--cor-status-ok);
  background: var(--cor-status-ok-tint);
  color: var(--cor-status-ok-texto);
}''', 1, '.toggle-btn.on')

# Botoes: separar acao primaria (laranja) de confirmacao positiva (verde)
# de neutro. .btn-secondary vira NEUTRO; quem confirma sucesso usa .btn-ok.
troca('''.active-tab,
.btn-primary {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 9px 18px rgba(255, 138, 0, 0.25);
}

.btn-secondary {
  background: var(--secondary);
  color: #fff;
}''', '''/* Acao primaria: laranja forte. So o que move o pedido pra frente
   (Confirmar pedido, Chamar senha, Novo pedido). Se tudo for laranja,
   nada e laranja — o operador perde a referencia de onde tocar. */
.btn-primary {
  background: var(--cor-acao);
  color: #fff;
  box-shadow: none;
}

.btn-primary:active {
  background: var(--cor-acao-pressionado);
}

/* Confirmacao positiva: verde. Exclusivo de "deu certo" —
   Pagamento confirmado e Entregue / OK. */
.btn-ok {
  background: var(--cor-status-ok);
  color: #fff;
}

/* Neutro: acao de apoio que nao e nem primaria nem sucesso
   (Imprimir cupom, Som, Baixar relatorio, Conectar impressora). */
.btn-secondary {
  background: var(--cor-superficie);
  color: var(--cor-texto);
  border: 1px solid var(--cor-borda-forte);
}

/* Adicionar produto na grade: acao repetida dezenas de vezes por hora.
   Fica visivel mas discreta, pra nao competir com o Confirmar pedido. */
.btn-add {
  background: var(--cor-acao-tint);
  color: var(--cor-acao-texto);
  border: 1px solid var(--cor-acento-suave);
  width: 100%;
}''', 1, 'botoes primary/secondary')

# ------------------------------------------------------------------
# 3. Renome global dos tokens antigos (ordem importa)
# ------------------------------------------------------------------
for antigo, novo in [
    ('var(--primary-dark)', 'var(--cor-acao-texto)'),
    ('var(--primary)', 'var(--cor-acao)'),
    ('var(--card)', 'var(--cor-superficie)'),
    ('var(--text)', 'var(--cor-texto)'),
    ('var(--muted)', 'var(--cor-texto-suave)'),
    ('var(--danger)', 'var(--cor-perigo)'),
    ('var(--border)', 'var(--cor-borda)'),
    ('var(--soft)', 'var(--cor-acao-tint)'),
    ('var(--warning)', 'var(--cor-atencao-tint)'),
    ('var(--shadow)', 'var(--sombra)'),
]:
    css = css.replace(antigo, novo)

if 'var(--secondary)' in css:
    erros.append('sobrou var(--secondary) sem decisao explicita')

# ------------------------------------------------------------------
# 4. Varredura dos hex soltos
# ------------------------------------------------------------------
LITERAIS = [
    # superficie rebaixada
    ('#fffaf3', 'var(--cor-superficie-2)'),
    ('#fffdf5', 'var(--cor-superficie-2)'),
    # cinzas/azuis genericos herdados das telas de auth e configuracoes
    ('#e2e6ee', 'var(--cor-borda)'),
    ('#e5e7eb', 'var(--cor-borda)'),
    ('#eef1f6', 'var(--cor-superficie-2)'),
    ('#f7f9fc', 'var(--cor-superficie-2)'),
    ('#f3f4f6', 'var(--cor-fundo)'),
    ('#f1f1f1', 'var(--cor-superficie-2)'),
    ('#6b7280', 'var(--cor-texto-suave)'),
    ('#56617a', 'var(--cor-texto-suave)'),
    ('#9ca3af', 'var(--cor-cinza)'),
    ('#b6bdcc', 'var(--cor-cinza)'),
    ('#b9c2d4', 'var(--cor-borda-forte)'),
    ('#c9d2e2', 'var(--cor-borda-forte)'),
    ('#111827', 'var(--cor-texto)'),
    # verdes diversos -> status
    ('#16a34a', 'var(--cor-status-ok)'),
    ('#2e9e5b', 'var(--cor-status-ok)'),
    ('#1f7a3f', 'var(--cor-status-ok-texto)'),
    ('#047857', 'var(--cor-status-ok-texto)'),
    ('#1b7a3d', 'var(--cor-status-ok-texto)'),
    ('#eaf6ee', 'var(--cor-status-ok-tint)'),
    ('#ecfdf5', 'var(--cor-status-ok-tint)'),
    ('#e6f7ec', 'var(--cor-status-ok-tint)'),
    # azuis (papel de operador) -> institucional
    ('#eff6ff', 'var(--cor-acao-tint)'),
    ('#1d4ed8', 'var(--cor-acao-texto)'),
    ('#2563eb', 'var(--cor-acao-texto)'),
    # vermelhos
    ('#dc2626', 'var(--cor-perigo)'),
    ('#fdeaea', 'var(--cor-perigo-tint)'),
    # amarelos de aviso
    ('#fff4cc', 'var(--cor-atencao-tint)'),
    ('#fdf0d5', 'var(--cor-atencao-tint)'),
    ('#fff5e6', 'var(--cor-atencao-tint)'),
    ('#f59e0b', 'var(--cor-institucional)'),
    ('#ffd699', 'var(--cor-acento-suave)'),
    ('#efd47a', 'var(--cor-acento-suave)'),
    ('#8a6500', 'var(--cor-atencao-texto)'),
    ('#8a5a00', 'var(--cor-atencao-texto)'),
    ('#745300', 'var(--cor-atencao-texto)'),
    ('#634800', 'var(--cor-atencao-texto)'),
    # laranja antigo
    ('#fff1df', 'var(--cor-acao-tint)'),
    ('#ff8a00', 'var(--cor-acao)'),
    ('#d86f00', 'var(--cor-acao-texto)'),
]
for antigo, novo in LITERAIS:
    css = re.sub(antigo, novo, css, flags=re.IGNORECASE)

# fundo de cartao branco -> papel (so onde e fundo, nunca texto branco)
css = css.replace('background: #fff;', 'background: var(--cor-superficie);')
css = css.replace('background: #ffffff;', 'background: var(--cor-superficie);')
css = css.replace('background: white;', 'background: var(--cor-superficie);')

with open(CAMINHO, 'w', encoding='utf-8') as f:
    f.write(css)

if erros:
    print('ERROS:')
    for e in erros:
        print(' -', e)
    sys.exit(1)

restantes = sorted(set(re.findall(r'#[0-9a-fA-F]{6}\b', css)))
print('OK. Hex restantes:', ', '.join(restantes) if restantes else 'nenhum')
