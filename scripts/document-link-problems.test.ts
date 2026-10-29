import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, it } from "vite-plus/test"
import { documentLinkProblems } from "@/scripts/document-link-problems"

const workspace = { root: "" }
beforeEach(() => {
  workspace.root = mkdtempSync(join(tmpdir(), "dnd-doc-links-"))
  mkdirSync(join(workspace.root, ".docs/rooms"), { recursive: true })
  writeFileSync(join(workspace.root, ".docs/rooms/bedroom.md"), "# 寝室")
})
afterEach(() => rmSync(workspace.root, { recursive: true, force: true }))

it("資料ルートを基準に別名付きWikiリンクを解決する", () => {
  expect(
    documentLinkProblems({
      root: workspace.root,
      file: "people/alma.md",
      source: "[[rooms/bedroom#寝室|寝室]]",
    })
  ).toEqual([])
})

it.each([
  "[寝室](../rooms/bedroom.md)",
  "[[../rooms/bedroom]]",
  "[[rooms/missing]]",
  "[[public/tmp/portrait.webp]]",
  "[[private/art/original.png]]",
  "[[node_modules/.cache/result.json]]",
  "[[.env]]",
])("維持できない参照を検出する: %s", (source) => {
  expect(
    documentLinkProblems({
      root: workspace.root,
      file: "people/alma.md",
      source,
    })
  ).toHaveLength(1)
})

it("コードの例を実際の参照と取り違えない", () => {
  expect(
    documentLinkProblems({
      root: workspace.root,
      file: "guide.md",
      source: "```md\n[[rooms/example]]\n```",
    })
  ).toEqual([])
})
