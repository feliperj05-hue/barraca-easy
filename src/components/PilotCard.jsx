import { useCallback, useEffect, useState } from 'react'
import {
  listarNotas,
  apagarNota,
  limparNotas,
  categoriaLabel,
  baixarDiagnostico,
} from '../services/pilotLog.js'

// Secao "Piloto" das Configuracoes (issue #77).
//
// Existe por um motivo bem concreto: os avisos que o app registra sozinho
// (#59) e a fila de vendas que ainda nao subiu vivem no IndexedDB do tablet.
// Sem um botao aqui, acabado o dia de piloto esse material fica preso no
// aparelho — e eu ficaria so com o relato de memoria de quem operou.
//
// O botao gera um arquivo de texto comum. Da pra abrir e ler no proprio
// tablet, e da pra mandar por WhatsApp ou e-mail sem plugar nada em lugar
// nenhum. Nao vai senha, nem token, nem chave de acesso.
export default function PilotCard({ notify, contexto }) {
  const [notas, setNotas] = useState([])
  const [previa, setPrevia] = useState(null)

  const recarregar = useCallback(() => setNotas(listarNotas()), [])
  useEffect(recarregar, [recarregar])

  async function baixar() {
    try {
      const texto = await baixarDiagnostico(contexto)
      setPrevia(texto)
      notify('Arquivo gerado. Procure na pasta de downloads do tablet.')
    } catch {
      notify('Não consegui gerar o arquivo neste aparelho.')
    }
  }

  return (
    <div className="panel settings-panel">
      <div className="panel-title">
        <h2>Piloto</h2>
      </div>
      <p className="muted">
        Tudo que foi anotado durante a operação, mais o que o app registrou sozinho. Serve pra
        contar depois o que realmente aconteceu no dia.
      </p>

      <div className="pilot-actions">
        <button type="button" className="btn-primary" onClick={baixar}>
          Baixar relatório do piloto
        </button>
        {notas.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              limparNotas()
              recarregar()
              setPrevia(null)
              notify('Anotações apagadas.')
            }}
          >
            Apagar anotações
          </button>
        )}
      </div>

      <h3 className="pilot-subtitle">Recados ({notas.length})</h3>
      {notas.length === 0 && (
        <p className="muted">
          Nenhum recado ainda. Durante a operação, use o link{' '}
          <strong>Fale com o desenvolvedor</strong> no rodapé da tela.
        </p>
      )}
      <ul className="pilot-notes">
        {notas.map((n) => (
          <li key={n.id}>
            <div className="pilot-note-head">
              <strong>{categoriaLabel(n.categoria)}</strong>
              <span className="muted">{new Date(n.ts).toLocaleString('pt-BR')}</span>
            </div>
            {n.texto && <p className="pilot-note-text">“{n.texto}”</p>}
            <p className="muted small">
              {n.tela ? 'Tela: ' + n.tela + ' · ' : ''}
              Conexão: {n.online ? 'ok' : 'caiu'} · Não enviados: {n.pendentes} ·{' '}
              {n.enviado ? 'chegou na nuvem' : 'ainda no aparelho'}
            </p>
            <button
              type="button"
              className="btn-ghost small"
              onClick={() => {
                apagarNota(n.id)
                recarregar()
              }}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      {previa && (
        <details className="pilot-preview">
          <summary>Ver o conteúdo do relatório</summary>
          <pre>{previa}</pre>
        </details>
      )}
    </div>
  )
}
