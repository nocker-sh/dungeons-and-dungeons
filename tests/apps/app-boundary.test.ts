import { readdirSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vite-plus/test"

const root = resolve(import.meta.dirname, "../..")

/** tsconfig の別名を、リポジトリ直下からのパスへ戻す。 */
const aliases: [string, string][] = [
  ["@/client/", "apps/main/client/"],
  ["@/pages/", "apps/main/pages/"],
  ["@/development/", "apps/studio/development/"],
  ["@/", ""],
]

function files(dir: string): string[] {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      if (["node_modules", "dist", ".void"].includes(entry.name)) return []
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) return files(path)
      return /\.tsx?$/.test(entry.name) ? [path] : []
    }
  )
}

function imports(file: string) {
  const source = readFileSync(resolve(root, file), "utf8")
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.flatMap((entry) => {
      const path = entry.fileName
      if (path.startsWith("."))
        return [relative(root, resolve(root, dirname(file), path))]
      const alias = aliases.find(([prefix]) => path.startsWith(prefix))
      return alias ? [alias[1] + path.slice(alias[0].length)] : []
    })
}

function crossings(dirs: string[], forbidden: RegExp) {
  return dirs.flatMap((dir) =>
    files(dir).flatMap((file) =>
      imports(file)
        .filter((path) => forbidden.test(path))
        .map((path) => `${file} → ${path}`)
    )
  )
}

describe("アプリの境界", () => {
  it("ゲームは開発アプリのコードを読まない（本番に開発用の入口を含めない）", () => {
    expect(crossings(["apps/main"], /^apps\/studio\//)).toEqual([])
  })

  it("共有コードはアプリに依存しない", () => {
    expect(crossings(["lib", "content", "concept"], /^apps\//)).toEqual([])
  })
})
