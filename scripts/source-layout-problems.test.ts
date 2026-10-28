import { afterEach, beforeEach, expect, it } from "vite-plus/test"
import { mkdtempSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { sourceLayoutProblems } from "@/scripts/source-layout-problems"

const workspace = { root: "" }
beforeEach(() => {
  workspace.root = mkdtempSync(join(tmpdir(), "dnd-layout-"))
})
afterEach(() => {
  rmSync(workspace.root, { recursive: true, force: true })
})

it.each([
  ["card.tsx", "card.test.tsx"],
  ["artwork.cjs", "artwork.test.mjs"],
])("実装%sと単体テスト%sを同じフォルダへ置ける", (source, test) => {
  expect(
    sourceLayoutProblems({
      root: workspace.root,
      files: [
        join(workspace.root, "client", source),
        join(workspace.root, "client", test),
      ],
    })
  ).toEqual([])
})

it("対応する実装のないテストはtests/へ置く", () => {
  expect(
    sourceLayoutProblems({
      root: workspace.root,
      files: [join(workspace.root, "client/card.test.tsx")],
    })
  ).toHaveLength(1)
  expect(
    sourceLayoutProblems({
      root: workspace.root,
      files: [join(workspace.root, "tests/card.test.tsx")],
    })
  ).toEqual([])
})

it("作品固有のモジュールをlibに戻さない", () => {
  mkdirSync(join(workspace.root, "lib/content"), { recursive: true })
  expect(
    sourceLayoutProblems({ root: workspace.root, files: [] })
  ).toHaveLength(1)
})
