import { tween } from "@/client/components/canvas/tween"
import { useEffect, useState } from "react"

/** 押すと全文、もう一度押すと次へ。 */
export function useTyping(text: string) {
  // 何文字出したかは、どのセリフの分かと組で持つ。セリフが替わった最初の描画で、
  // 前のセリフの文字数のまま新しいセリフを一瞬出さないため
  const [typed, setTyped] = useState({ text, count: 0 })
  const shown = typed.text === text ? typed.count : 0
  const [revealed, setRevealed] = useState<string | null>(null)
  useEffect(() => {
    setTyped({ text, count: 0 })
    const animation = tween(0, text.length, text.length * 26, (value) =>
      setTyped({ text, count: Math.floor(value) })
    )
    return animation.cancel
  }, [text])
  return {
    shown: revealed === text ? text : text.slice(0, shown),
    done: revealed === text || shown >= text.length,
    finish: () => setRevealed(text),
  }
}
