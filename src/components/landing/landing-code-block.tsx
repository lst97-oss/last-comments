'use client'

import { useEffect, useRef } from 'react'

import { codeBlockMarkup, highlightCodeBlocks } from '@/lib/code-block'

// The frame is rendered as markup so the highlighter can swap the code
// inside it without fighting React over the button's icon.
export function LandingCodeBlock({ code, lang }: { code: string; lang: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const controller = new AbortController()
    void highlightCodeBlocks(root, controller.signal)
    return () => controller.abort()
  }, [code, lang])

  // `min-w-0`: as a grid item the block would otherwise keep its min-content
  // width (the longest code line) and push the page into horizontal overflow.
  return <div className="min-w-0" ref={ref} dangerouslySetInnerHTML={{ __html: codeBlockMarkup(lang, code) }} />
}
