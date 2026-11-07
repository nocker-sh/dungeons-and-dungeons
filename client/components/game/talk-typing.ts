import { tween } from "@/client/components/canvas/tween"
import { useEffect, useState } from "react"

/** 押すと全文、もう一度押すと次へ。同じ文章も台詞ごとに送り直す。 */
export function useTyping(text: string, line: object | undefined) {
  const [typed, setTyped] = useState({ text, line, count: 0, revealed: false })
  const current = typed.text === text && typed.line === line
  useEffect(() => {
    setTyped({ text, line, count: 0, revealed: false })
    const animation = tween(0, text.length, text.length * 26, (value) =>
      setTyped((previous) =>
        previous.text === text && previous.line === line
          ? { ...previous, count: Math.floor(value) }
          : previous
      )
    )
    return animation.cancel
  }, [text, line])
  return {
    shown: current ? (typed.revealed ? text : text.slice(0, typed.count)) : "",
    done: current
      ? typed.revealed || typed.count >= text.length
      : text.length === 0,
    finish: () => setTyped({ text, line, count: text.length, revealed: true }),
  }
}
