# Como colocar o Barraca Easy no GitHub

## 1. Criar pasta local

```bash
mkdir barraca-easy
cd barraca-easy
```

## 2. Inicializar Git

```bash
git init
```

## 3. Criar projeto React + Vite

```bash
npm create vite@latest . -- --template react
npm install
```

## 4. Testar localmente

```bash
npm run dev
```

## 5. Criar arquivos de documentação

Copie estes arquivos para a raiz do projeto:

- `README.md`
- `PRODUCT_SPEC.md`
- `ARCHITECTURE.md`
- `AGENT_HANDOVER_PROMPT.md`

## 6. Adicionar o protótipo HTML como referência

Crie uma pasta:

```bash
mkdir prototypes
```

Copie o arquivo atual para:

```text
prototypes/barraca_easy_com_configuracoes.html
```

## 7. Primeiro commit

```bash
git add .
git commit -m "Initial Barraca Easy MVP structure and documentation"
```

## 8. Criar repositório no GitHub

No GitHub:

1. Clique em `New repository`.
2. Nome: `barraca-easy`.
3. Pode deixar como privado no início.
4. Não marque para criar README, se você já criou localmente.
5. Crie o repositório.

## 9. Conectar remoto

Troque `SEU_USUARIO` pelo seu usuário do GitHub.

### Via SSH

```bash
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/barraca-easy.git
git push -u origin main
```

### Via HTTPS

```bash
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/barraca-easy.git
git push -u origin main
```

## 10. Branch de desenvolvimento

```bash
git checkout -b develop
git push -u origin develop
```

## 11. Primeira branch para o agente IA

```bash
git checkout -b feature/react-local-mvp
git push -u origin feature/react-local-mvp
```

Depois conecte o Claude Code nessa branch.

## Ordem recomendada para o agente

1. Ler `README.md`.
2. Ler `PRODUCT_SPEC.md`.
3. Ler `ARCHITECTURE.md`.
4. Ler `AGENT_HANDOVER_PROMPT.md`.
5. Usar o HTML em `prototypes/` apenas como referência visual e funcional.
6. Implementar React + Vite com localStorage.
