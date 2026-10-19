import { useEffect, useRef, useState } from 'react'

type CopyState = 'idle' | 'copied' | 'error'

interface CopyButtonProps {
  text: string
  label: string
  disabled?: boolean
}

const RESET_DELAY_MS = 2000

export default function CopyButton({
  text,
  label,
  disabled = false,
}: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle')
  const timeoutRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    },
    [],
  )

  const handleCopy = async () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable')
      }
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('error')
    }

    timeoutRef.current = window.setTimeout(() => {
      setState('idle')
    }, RESET_DELAY_MS)
  }

  const visibleLabel =
    state === 'copied' ? 'Copied' : state === 'error' ? 'Copy failed' : label

  return (
    <button
      type="button"
      className={`button button--ghost button--small${
        state === 'error' ? ' button--error' : ''
      }`}
      onClick={handleCopy}
      disabled={disabled}
      aria-label={label}
    >
      {visibleLabel}
      <span className="visually-hidden" role="status">
        {state === 'copied'
          ? 'Copied to clipboard'
          : state === 'error'
            ? 'Copy failed'
            : ''}
      </span>
    </button>
  )
}
