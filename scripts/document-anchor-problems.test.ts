import { expect, it } from "vite-plus/test"
import { documentAnchorProblems } from "@/scripts/document-anchor-problems"

it("日本語の見出しとコード表記を参照できる", () => {
  expect(
    documentAnchorProblems({
      file: "guide.md",
      source: "## `保存`の境界",
      anchor: "保存の境界",
    })
  ).toEqual([])
})
it.each(["## 保存を変更した", "## 保存\n\n## 保存", "```md\n## 保存\n```"])(
  "存在しない、または曖昧な見出しを拒否する: %s",
  (source) => {
    expect(
      documentAnchorProblems({ file: "guide.md", source, anchor: "保存" })
    ).toHaveLength(1)
  }
)
