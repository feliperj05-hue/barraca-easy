# LGPD — Barraca Easy

Documento de trabalho para levar ao advogado. Duas partes:

1. **O mapa do que o software faz hoje** — levantado lendo o schema e o código,
   não estimado. É a base factual pra qualquer parecer.
2. **As perguntas objetivas** que dependem de decisão jurídica.

> Escrito por engenharia. Não é parecer jurídico e não substitui um.
> Issue de referência: #87.

---

# Parte 1 — O que o software trata hoje

## 1.1 O ponto mais importante: não há dado de cliente final

O Barraca Easy **não coleta e não armazena nenhum dado da pessoa que compra**.

Uma venda registrada guarda:

| Campo | Exemplo |
|---|---|
| Número da senha (papel entregue na mão) | `027` |
| Forma de pagamento | `pix` / `cartao` / `dinheiro` |
| Total | `R$ 18,00` |
| Status | `aguardando` / `chamado` / `entregue` / `cancelado` |
| Horários | criação, pagamento, chamada, entrega, cancelamento |
| Itens | nome do produto, preço unitário, quantidade |

Não existe nome, CPF, telefone, e-mail, endereço, foto ou qualquer identificador
do consumidor — nem em banco, nem no aparelho, nem no cupom impresso.

Isso é consequência do desenho do produto: a senha é física e o pagamento
acontece fora do sistema, então o cliente nunca precisou se identificar. **É um
ativo de conformidade e não deve ser perdido sem decisão consciente** (ver
Parte 3).

## 1.2 Não há dado pessoal sensível

Na definição do art. 5º, II da LGPD (origem racial ou étnica, convicção
religiosa, opinião política, filiação a sindicato ou a organização de caráter
religioso/filosófico/político, dado referente à saúde ou à vida sexual, dado
genético ou biométrico): **nenhum**. O sistema não tem campo para nada disso.

## 1.3 Dado pessoal que existe — todo ele de quem opera, não de cliente

| Onde fica | Dado | Para que serve | Prazo |
|---|---|---|---|
| Supabase Auth (`auth.users`) | e-mail e hash de senha | login | enquanto a conta existir |
| `membros` | vínculo pessoa ↔ barraca + papel (dono/operador) | permissões | enquanto a pessoa operar |
| `tenants.nome` | nome da barraca | identificação | enquanto a barraca existir |
| Aparelho (`localStorage`) | nome, telefone, documento e endereço da barraca | cabeçalho do cupom | até o operador apagar |
| `feedback` | e-mail do operador, resumo do aparelho, tela, papel, texto do recado | responder e investigar | 12 meses |
| Aparelho (`localStorage`) | recados e avisos automáticos | funcionar offline | 90 dias |

Observações relevantes:

- A senha de acesso nunca é vista pela aplicação nem pelo desenvolvedor: quem
  guarda é o Supabase Auth, cifrada.
- Se a barraca for MEI e o operador digitar CPF no campo de documento, esse CPF
  é dado pessoal — mas é do próprio titular do negócio, digitado por ele, e fica
  apenas no aparelho dele.

## 1.4 Minimização já implementada (#87)

Antes: cada recado e cada relatório de diagnóstico levavam a **string completa
de user-agent** (modelo exato do aparelho, versão exata do sistema e do
navegador) e a **URL completa** do app.

Agora: vai só `Android 13 · Chrome` e a origem do endereço. É o suficiente para
investigar um defeito e deixa de permitir reconhecer um aparelho específico.

## 1.5 Onde os dados ficam (e transferência internacional)

- **Banco de dados: Supabase, região São Paulo (Brasil).** Confirmado com o
  titular do projeto. Dado pessoal não sai do país.
- **Hospedagem do app: Firebase Hosting (Google).** Serve apenas os arquivos
  estáticos da interface (HTML, CSS, JavaScript, ícones). **Nenhum dado pessoal
  trafega ou é armazenado ali** — o app fala direto com o Supabase.
- Logs de acesso do provedor de hospedagem (IP, horário) são tratamento do
  próprio provedor. Ver pergunta Q6.

## 1.6 Medidas de segurança já em funcionamento

- **Row-Level Security** no banco: cada barraca só enxerga as próprias linhas,
  aplicado pelo servidor. Não é filtro de tela, é regra de banco.
- **HTTPS obrigatório** em todo o tráfego.
- **Senha gerenciada pelo Supabase Auth**, com hash; a aplicação não a manipula.
- **Chave publicável no navegador é pública por design** e só funciona dentro do
  que a RLS permite. A chave `service_role` nunca sai do painel e nunca entra no
  repositório.
- **Sem update nem delete** na tabela de feedback: histórico não é reescrito.
- **Retenção automática**: 90 dias no aparelho, 12 meses na nuvem.

O que ainda **não** existe e é decisão consciente de fase (entra quando o
produto for cobrado, não no piloto): autenticação em duas etapas e registro de
auditoria de acesso.

---

# Parte 2 — Perguntas para o advogado

Estas são as decisões que engenharia não pode tomar sozinha. Respondidas,
consigo implementar tudo que for de software.

### Q1. Papel do Felipe: controlador, operador, ou os dois?

Hoje o app roda em barracas do próprio Felipe e de familiares — parece
controlador puro. Quando virar SaaS cobrado de terceiros (planejado), ele passa
a hospedar dado de clientes de outras pessoas.

- Nessa fase ele vira **operador** em relação ao dado que a barraca cliente
  colocar lá?
- Precisa de contrato de tratamento (art. 39) com cada cliente? Modelo?
- Muda alguma coisa o fato de que hoje o único dado pessoal na nuvem é o e-mail
  do próprio usuário do sistema?

### Q2. Base legal para cada tratamento

Nossa leitura (a confirmar):

| Tratamento | Base sugerida |
|---|---|
| Conta e login do operador | execução de contrato (art. 7º, V) |
| Vínculo com a barraca e papel | execução de contrato |
| Recado do "Fale com o desenvolvedor" | legítimo interesse (art. 7º, IX) |
| Diagnóstico técnico (tela, conexão, resumo do aparelho) | legítimo interesse |

- Está correto? Legítimo interesse aguenta o diagnóstico técnico ou é melhor
  pedir consentimento?
- Precisa de teste de balanceamento documentado para o legítimo interesse?

### Q3. Política de privacidade e termos de uso

Já existe uma tela dentro do app com o mapa de dados verdadeiro (item 1.3),
escrita por engenharia. Precisamos da versão jurídica.

- Você redige a partir deste documento, ou prefere um formulário seu?
- Termos de uso precisam ser aceitos no cadastro (checkbox com registro de data
  e hora) ou basta estarem disponíveis? Se precisar de aceite registrado, eu
  implemento — só preciso saber **o que** registrar.
- Precisa de versionamento da política (guardar qual versão a pessoa aceitou)?

### Q4. Prazos de retenção

Implementamos, sujeito a revisão:

| Dado | Prazo adotado |
|---|---|
| Recado no aparelho | 90 dias |
| Recado na nuvem | 12 meses |
| Conta do operador | enquanto usar + exclusão a pedido |
| Vendas e fechamentos | sem prazo de LGPD (não têm dado pessoal); guarda fiscal manda |

- Os prazos de 90 dias e 12 meses são defensáveis?
- **Sobre vendas e fechamentos:** nossa leitura é que, por não conterem dado
  pessoal, LGPD não impõe prazo, e o que vale é a guarda contábil/fiscal
  (usualmente 5 anos). Confirma? Qual prazo você recomenda ao MEI?

### Q5. Direitos do titular

Hoje o canal é o "Fale com o desenvolvedor" dentro do app.

- Isso basta como canal de atendimento ao titular, ou precisa de e-mail
  específico publicado (tipo `privacidade@...`)?
- Qual prazo de resposta devemos prometer por escrito?
- Precisa nomear encarregado (DPO) formalmente, sendo MEI? Se sim, o próprio
  Felipe pode ser, e o que precisa estar publicado?
- Na exclusão de conta a pedido: apagamos tudo, ou há dado que devemos reter por
  obrigação legal mesmo após o pedido?

### Q6. Subprocessadores e infraestrutura

- Supabase (banco, região São Paulo) e Google/Firebase (hospedagem dos arquivos
  estáticos) precisam ser nomeados na política?
- Firebase serve só arquivo estático, mas registra log de acesso com IP no lado
  do provedor. Isso precisa ser declarado?
- Precisamos guardar cópia dos termos de tratamento dessas empresas?

### Q7. Incidente de segurança

- Que prazo e que forma devemos nos comprometer a cumprir (ANPD e titulares)?
- Existe modelo de comunicação que você recomende deixar pronto?

### Q8. Registro das operações de tratamento (RIPD)

- Sendo MEI com esse volume, precisa? Se sim, este documento serve de base ou o
  formato é outro?

---

# Parte 3 — O que muda o jogo (avaliar antes de implementar)

Hoje o risco de LGPD é baixo justamente porque não há dado de consumidor. Cada
item abaixo **quebra** isso e, se for pra existir, entra já com base legal,
retenção e política ajustadas — nunca depois:

| Feature | O que passa a ser tratado |
|---|---|
| Pix integrado | nome e chave de quem paga |
| Cartão integrado | dado de pagamento (e provavelmente escopo PCI-DSS) |
| Cadastro de cliente / fidelidade | nome, telefone, histórico de compra |
| Chamar senha por WhatsApp/SMS | telefone do consumidor |
| NFC-e / cupom fiscal com CPF | CPF do consumidor |
| Câmera, foto ou biometria em qualquer forma | dado sensível |

Recomendação de engenharia: cada uma dessas passa por uma issue própria com
seção de privacidade obrigatória antes de uma linha de código.

---

# Parte 4 — Como aplicar o que já foi feito

1. Rodar `supabase/migrations/20260718200000_feedback.sql` (tabela de feedback).
2. Rodar `supabase/migrations/20260718210000_feedback_retencao.sql` (limpeza
   automática de 12 meses).
3. Se `pg_cron` não estiver habilitado no projeto: Database > Extensions >
   pg_cron. Sem ele, a limpeza vira manual (`select
   public.limpar_feedback_antigo();`).

Ambos idempotentes, ambos nos **dois** projetos (staging e produção).
