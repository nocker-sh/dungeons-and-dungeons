import { readdirSync, readFileSync } from "node:fs"
import { matchesGlob, relative, resolve } from "node:path"
import { describe, expect, it } from "vite-plus/test"
import { isolatedTests } from "@/scripts/isolated-tests"

const root = resolve(import.meta.dirname, "../..")
const skipped = new Set([
  "node_modules",
  ".git",
  ".void",
  ".wrangler",
  ".claude",
  "dist",
  "public",
  "private",
  ".docs",
])

/** Vitest の既定の探索と同じく、`.test`・`.spec` の付いた全ファイル（.ts・.tsx・.js・.mjs など）。 */
function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (skipped.has(entry.name)) return []
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) return testFiles(path)
    return /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : []
  })
}

// このファイル自身が一致しないよう、検出する書き方は分けて組み立てる
const stateful = new RegExp(
  [
    // モック・偽タイマー・グローバルと環境変数の差し替え・jsdom の指定・終了コード・作業ディレクトリ
    String.raw`\bvi\.(?:mock|doMock|stubGlobal|stubEnv|useFakeTimers)\(`,
    "@vitest" + "-environment",
    String.raw`process\.exitCode\s*=`,
    String.raw`process\.env\.[A-Za-z_]+\s*=(?!=)`,
    String.raw`process\.chdir\(`,
    // 画面の描画と、画面側のモジュール状態（演出の時計）
    String.raw`from "(?:react-dom(?:/[a-z]+)?|@testing-library/[a-z-]+)"`,
    String.raw`\b(?:animationClock|stillClock)\.[a-zA-Z]+\s*=(?!=)`,
  ].join("|")
)

describe("テストの実行プロセス", () => {
  it("プロセスや画面の状態を変えるテストは、1ファイルずつ別のプロセスで動かす", () => {
    const files = testFiles(root).map((file) => relative(root, file))
    expect(files.length).toBeGreaterThan(100)
    const shared = files.filter(
      (file) => !isolatedTests.some((glob) => matchesGlob(file, glob))
    )
    // 共有するプロセスへ入るテストがあること（区分けが全件を隔離側へ吸い込んでいない）
    expect(shared.length).toBeGreaterThan(files.length / 2)
    const leaking = shared.filter((file) =>
      stateful.test(readFileSync(resolve(root, file), "utf8"))
    )
    expect(leaking).toEqual([])
  })

  it("隔離する指定は、どれも実在するテストに一致する", () => {
    const files = testFiles(root).map((file) => relative(root, file))
    for (const glob of isolatedTests)
      expect(
        files.some((file) => matchesGlob(file, glob)),
        glob
      ).toBe(true)
  })
})
