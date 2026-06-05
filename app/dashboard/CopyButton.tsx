'use client'

import { useState } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        background: copied ? 'rgba(76,175,80,.15)' : 'rgba(100,181,246,.1)',
        border: `1px solid ${copied ? 'rgba(76,175,80,.4)' : 'rgba(100,181,246,.3)'}`,
        borderRadius: '6px',
        color: copied ? '#81c784' : 'var(--accent1)',
        padding: '4px 14px',
        fontSize: '.72rem',
        fontFamily: 'Trebuchet MS, sans-serif',
        letterSpacing: '1px',
        cursor: 'pointer',
        transition: 'all .2s',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copiado!' : 'Copiar'}
    </button>
  )
}
