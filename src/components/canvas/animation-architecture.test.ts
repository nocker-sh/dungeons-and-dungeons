import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory()
      ? sources(path)
      : /\.tsx?$/.test(path) && !path.endsWith(".test.ts")
        ? [path]
        : []
  })
}

describe("ゲーム演出のライブラリ境界", () => {
  it("完了を秒数で推測するタイマーと、ライブラリ外のCSS transitionを戻さない", () => {
    const violations: string[] = []
    for (const directory of ["canvas", "stage", "game", "screens"]) {
      for (const path of sources(`src/components/${directory}`)) {
        const source = readFileSync(path, "utf8")
        if (/\bset(?:Timeout|Interval)\s*\(/.test(source))
          violations.push(`${path}: timer`)
        if (/\btransition\s*:\s*["'`]/.test(source))
          violations.push(`${path}: CSS transition`)
        if (
          /\brequestAnimationFrame\s*\(/.test(source) &&
          !path.endsWith("/focus.ts")
        )
          violations.push(`${path}: manual frame loop`)
      }
    }
    expect(violations).toEqual([])
  })
})
