import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vite-plus/test"
import { releaseBundleProblems } from "@/scripts/release-bundle-problems"

it("本番の配布物に残った開発用の入口を見つける", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-"))
  mkdirSync(join(dir, "assets"))
  writeFileSync(join(dir, "assets", "game.js"), "const a = 'ok'")
  expect(releaseBundleProblems(dir)).toEqual([])
  writeFileSync(
    join(dir, "assets", "leak.js"),
    "postMessage({type:'dnd-save'},'https://dev.dnd.localhost')"
  )
  expect(releaseBundleProblems(dir)).toHaveLength(2)
})
