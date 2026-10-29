import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, it } from "vite-plus/test"
import { checkDocs } from "@/scripts/check-docs"

const workspace = { root: "" }
beforeEach(() => {
  workspace.root = mkdtempSync(join(tmpdir(), "dnd-public-docs-"))
  for (const directory of [".docs", "concept/prompts", "private"])
    mkdirSync(join(workspace.root, directory), { recursive: true })
  writeFileSync(
    join(workspace.root, ".docs/index.md"),
    "# 仕様\n[[concept/prompts/portrait.json]]"
  )
  writeFileSync(
    join(workspace.root, "concept/prompts/portrait.json"),
    '{"prompt":"Round cheeks, flat colors."}'
  )
})
afterEach(() => rmSync(workspace.root, { recursive: true, force: true }))

it("非公開の原画を持たない公開チェックアウトでも資料を検査できる", async () => {
  expect(await checkDocs(workspace.root)).toEqual([])
})
it("ファイルが手元にあっても非公開データへの参照を拒否する", async () => {
  writeFileSync(join(workspace.root, "private/notes.json"), "{}")
  writeFileSync(
    join(workspace.root, ".docs/index.md"),
    "[[private/notes.json]]"
  )
  expect(await checkDocs(workspace.root)).toHaveLength(1)
})
it("プロンプトJSON内の端末パスも公開前に検出する", async () => {
  writeFileSync(
    join(workspace.root, "concept/prompts/portrait.json"),
    '{"source":"/Users/person/Desktop/portrait.png"}'
  )
  expect(await checkDocs(workspace.root)).toHaveLength(1)
})
