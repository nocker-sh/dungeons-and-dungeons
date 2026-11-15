import { readFileSync } from "node:fs"
import { describe, expect, it } from "vite-plus/test"

// プレイヤーは画面に姿を出さない運営役。登録で写真（容姿）を選ばせる台詞を残さない。
describe("運営役の台詞", () => {
  it.each(["content/data/talks.json", "content/data/conversations.json"])(
    "%s は登録で写真を選ばせない",
    (file) => {
      expect(readFileSync(file, "utf8")).not.toContain("写真")
    }
  )
})
