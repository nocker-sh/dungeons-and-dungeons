import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/lib/content/game-content"

/**
 * 会話の枠はセリフ2行の高さで、はみ出す分は「…」で切る（src/components/game/talk.tsx）。
 * スマホの縦画面で1行に入るのは全角18文字ほどなので、1回のセリフは36文字までにする。
 */
const MAX_LENGTH = 36

describe("会話のセリフの長さ", () => {
  it("どのセリフも、問いかけも、2行（36文字）に収まる", () => {
    const long: string[] = []
    for (const script of gameContent.conversations ?? []) {
      const lines = [
        ...script.lines,
        ...(script.choice?.options.flatMap((option) => option.lines) ?? []),
      ]
      for (const line of lines)
        if (line.text.length > MAX_LENGTH)
          long.push(`${script.id}: ${line.text}`)
      if (script.choice && script.choice.ask.length > MAX_LENGTH)
        long.push(`${script.id}: ${script.choice.ask}`)
    }
    expect(long).toEqual([])
  })

  it("セリフに「。」を付けない（文を区切るときは行を分ける）", () => {
    const withPeriod: string[] = []
    for (const script of gameContent.conversations ?? []) {
      const lines = [
        ...script.lines,
        ...(script.choice?.options.flatMap((option) => option.lines) ?? []),
      ]
      for (const line of lines)
        if (line.text.includes("。"))
          withPeriod.push(`${script.id}: ${line.text}`)
    }
    expect(withPeriod).toEqual([])
  })
})
