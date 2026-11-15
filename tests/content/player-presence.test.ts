import { expect, it } from "vite-plus/test"
import conversations from "@/content/data/conversations.json"

/** プレイヤーは画面に姿を出さず、着せ替えも持たない（.docs/game-spec.md）。 */
it("会話でプレイヤーの服装・格好に触れない", () => {
  const lines = conversations.flatMap((script) => [
    ...script.lines,
    ...(script.choice?.options.flatMap((option) => option.lines) ?? []),
  ])
  expect(
    lines.filter((line) => /その服|その格好|キミの服|あなたの服/.test(line.text))
  ).toEqual([])
})
