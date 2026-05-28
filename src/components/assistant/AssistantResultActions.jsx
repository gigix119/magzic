import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyTextToClipboard } from '../../utils/clipboard'

export default function AssistantResultActions({ summaryText, copyLabel = 'Kopiuj podsumowanie' }) {
  const [status, setStatus] = useState(null)

  if (!summaryText) return null

  async function handleCopy() {
    const result = await copyTextToClipboard(summaryText)
    setStatus(result.ok ? 'ok' : 'error')
    setTimeout(() => setStatus(null), 2000)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1 transition-all hover:opacity-80 active:opacity-60"
        style={{
          background: status === 'ok' ? 'rgba(34,197,94,0.08)' : 'var(--table-sub)',
          border: `1px solid ${status === 'ok' ? 'rgba(34,197,94,0.3)' : status === 'error' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
          color: status === 'ok' ? '#22c55e' : status === 'error' ? '#ef4444' : 'var(--muted)',
        }}
      >
        {status === 'ok' ? (
          <><Check size={10} />Skopiowano</>
        ) : status === 'error' ? (
          <>Nie udało się skopiować</>
        ) : (
          <><Copy size={10} />{copyLabel}</>
        )}
      </button>
    </div>
  )
}
