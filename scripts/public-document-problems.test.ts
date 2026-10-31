import { expect, it } from "vite-plus/test"
import { publicDocumentProblems } from "@/scripts/public-document-problems"

it.each([
  "/Users/person/Desktop/reference.png",
  "/home/person/reference.png",
  String.raw`C:\Users\person\reference.png`,
])("端末固有のパスを公開しない: %s", (source) => {
  expect(publicDocumentProblems({ file: "guide.md", source })).toHaveLength(1)
})

it("プロンプト・公開URL・CLIの一時保存例は公開できる", () => {
  expect(
    publicDocumentProblems({
      file: "guide.md",
      source: "Use case: portrait. https://dungeon.localhost /tmp/run.json",
    })
  ).toEqual([])
})

it("秘密の値をエラー本文へ再掲せず検出する", () => {
  const source = "sk-proj-" + "a".repeat(30)
  const problems = publicDocumentProblems({ file: "prompt.json", source })
  expect(problems).toHaveLength(1)
  expect(problems[0]).not.toContain(source)
})
