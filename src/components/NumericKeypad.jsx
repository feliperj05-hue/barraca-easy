import { useCallback, useEffect } from 'react'
import { pressDigit, pressErase } from '../utils/keypad.js'

// Teclado numérico do próprio app (#81).
//
// Por que existe: o Felipe testou no tablet e o teclado do Android come metade
// da tela. Num balcão isso não é detalhe de estética — o popup de pagamento
// sobe, o valor total sai da vista e o operador digita a senha sem enxergar o
// que está cobrando. Fora que cada fabricante entrega um teclado de altura
// diferente (Gboard, Samsung Keyboard), com linha de sugestão e autocorreção
// que não servem pra nada quando o campo só aceita número.
//
// Aqui a altura é fixa, o alvo é grande e o layout não pula. Nada de mágica:
// são botões de verdade, então leitor de tela, navegação por teclado físico e
// foco funcionam de graça.
//
// Decisões que valem a pena registrar:
//
// - Ordem 1-9 / 0, tipo telefone e caixa eletrônico. Teclado de computador tem
//   o 1 embaixo; quem opera balcão espera o de telefone.
// - Zero na largura de duas teclas: é a tecla mais usada em senha com zero à
//   esquerda, e serve de alvo folgado pro dedo apressado.
// - Apagar fica na direita, longe do zero, pra não apagar sem querer.
// - `type="button"` em tudo: dentro de um modal, um botão sem tipo vira submit
//   e manda a venda antes da hora.
export default function NumericKeypad({ value, onChange, onConfirm, maxLength = 6, disabled }) {
  const digitar = useCallback(
    (d) => {
      if (disabled) return
      onChange(pressDigit(value, d, maxLength))
    },
    [value, onChange, maxLength, disabled],
  )

  const apagar = useCallback(() => {
    if (disabled) return
    onChange(pressErase(value))
  }, [value, onChange, disabled])

  // Teclado físico continua funcionando: tem gente que liga teclado USB no
  // tablet, e tirar isso seria uma regressão silenciosa de acessibilidade.
  useEffect(() => {
    function onKey(e) {
      if (disabled) return
      if (/^[0-9]$/.test(e.key)) {
        digitar(e.key)
        e.preventDefault()
      } else if (e.key === 'Backspace') {
        apagar()
        e.preventDefault()
      } else if (e.key === 'Enter' && onConfirm) {
        onConfirm()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [digitar, apagar, onConfirm, disabled])

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className="keypad" role="group" aria-label="Teclado numérico">
      {teclas.map((t) => (
        <button
          key={t}
          type="button"
          className="keypad-key"
          disabled={disabled}
          onClick={() => digitar(t)}
        >
          {t}
        </button>
      ))}
      <button
        type="button"
        className="keypad-key keypad-zero"
        disabled={disabled}
        onClick={() => digitar('0')}
      >
        0
      </button>
      <button
        type="button"
        className="keypad-key keypad-erase"
        disabled={disabled}
        onClick={apagar}
        aria-label="Apagar último número"
      >
        <span aria-hidden="true">⌫</span>
      </button>
    </div>
  )
}
