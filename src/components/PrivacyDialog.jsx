import { useEffect, useState } from 'react'
import { DIAS_RETENCAO_LOCAL } from '../services/privacidade.js'

// Politica de privacidade dentro do app (#87, LGPD).
//
// POR QUE ESTA TELA EXISTE DENTRO DO APP E NAO NUM LINK PRA FORA
//
// A pessoa que opera a barraca nao vai atras de site nenhum. Se a informacao
// sobre o dado dela nao estiver do lado de onde ela usa o app, na pratica ela
// nao existe. Entao mora aqui, no mesmo rodape do "Fale com o desenvolvedor".
//
// A REGRA QUE ME OBRIGA A MANTER ISTO HONESTO
//
// O que esta escrito aqui e o mapa do que o codigo faz de verdade — conferido
// tabela por tabela, nao copiado de modelo da internet. Se um dia alguem
// adicionar um campo novo que guarde dado de pessoa, ESTE TEXTO TEM QUE MUDAR
// NO MESMO COMMIT. Politica que descreve um app que nao existe mais e pior que
// nenhuma: vira promessa quebrada por escrito.
//
// O texto e rascunho de engenharia. A redacao juridica final vem do advogado
// (ver LGPD.md); o que eu garanto aqui e que a descricao tecnica esta correta.
export default function PrivacyDialog() {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!aberto) return undefined
    function onKey(e) {
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto])

  if (!aberto) {
    return (
      <button type="button" className="dev-feedback-link privacy-link" onClick={() => setAberto(true)}>
        Privacidade
      </button>
    )
  }

  return (
    <div
      className="modal-backdrop show"
      role="dialog"
      aria-modal="true"
      aria-label="Privacidade e dados"
      onClick={() => setAberto(false)}
    >
      <div className="modal privacy-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Privacidade e dados</h2>
        <p>O que o Barraca Easy guarda, por que e por quanto tempo.</p>

        <div className="privacy-corpo">
          <h3>O que NÃO guardamos</h3>
          <p>
            <strong>Nada sobre o cliente da barraca.</strong> A venda registra o número da senha
            de papel, a forma de pagamento, o total e o horário. Não pedimos e não armazenamos
            nome, CPF, telefone, e-mail nem endereço de quem compra.
          </p>

          <h3>O que guardamos sobre quem opera</h3>
          <ul>
            <li>
              <strong>E-mail e senha de acesso.</strong> Para você entrar no app. A senha fica
              guardada de forma cifrada pelo serviço de autenticação; nem nós conseguimos lê-la.
            </li>
            <li>
              <strong>Sua barraca e seu papel</strong> (dono ou operador), para o app saber o que
              te mostrar.
            </li>
            <li>
              <strong>Dados da barraca</strong> — nome, telefone, documento e endereço que você
              digitar em Configurações. Ficam neste aparelho e saem no cupom, se você usar
              impressora.
            </li>
            <li>
              <strong>Recados enviados em “Fale com o desenvolvedor”</strong>, junto com a hora, a
              tela em que você estava, se a conexão estava de pé, seu e-mail e um resumo do
              aparelho (por exemplo “Android 13 · Chrome”). Não guardamos a identificação
              detalhada do seu aparelho.
            </li>
          </ul>

          <h3>Por quanto tempo</h3>
          <ul>
            <li>
              Recados guardados <strong>neste aparelho</strong>: até {DIAS_RETENCAO_LOCAL} dias,
              apagados automaticamente.
            </li>
            <li>
              Recados <strong>enviados para a nuvem</strong>: até 12 meses.
            </li>
            <li>
              <strong>Vendas e fechamentos</strong>: enquanto a barraca precisar deles para
              controle e obrigações fiscais. Não têm dado pessoal.
            </li>
            <li>
              <strong>Sua conta</strong>: enquanto você usar o app. Você pode pedir a exclusão a
              qualquer momento.
            </li>
          </ul>

          <h3>Onde os dados ficam</h3>
          <p>
            Em servidores no <strong>Brasil (São Paulo)</strong>, na infraestrutura do Supabase. O
            endereço do app é servido pelo Firebase Hosting, que entrega apenas os arquivos da
            tela — nenhum dado pessoal passa por ele.
          </p>

          <h3>Seus direitos</h3>
          <p>
            Você pode pedir para ver, corrigir ou apagar seus dados, e saber com quem eles foram
            compartilhados. Para isso, use o <strong>Fale com o desenvolvedor</strong>, aqui no
            rodapé, escolhendo “Reportar um problema” e escrevendo o pedido. Respondemos pelo
            e-mail da sua conta.
          </p>

          <p className="muted small">
            Este texto descreve exatamente o que o aplicativo faz hoje. A versão jurídica
            definitiva, com os termos de uso, está em elaboração.
          </p>
        </div>

        <div className="modal-actions privacy-actions">
          <button type="button" className="btn-ok" onClick={() => setAberto(false)}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
