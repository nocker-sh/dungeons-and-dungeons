import { existsSync } from "node:fs"
import { join, relative, sep } from "node:path"

type Props = { root: string; files: readonly string[] }

/** 単体テストの対応先と、作品固有モジュールの置き場所を検査する。 */
export function sourceLayoutProblems(props: Props): string[] {
  const files = new Set(props.files)
  const problems = ["content", "concept", "dev", "development"].flatMap((name) =>
    existsSync(join(props.root, "lib", name))
      ? [`lib/${name}: 作品固有のモジュールはlibの外に置く`]
      : []
  )
  for (const file of props.files) {
    if (
      !/\.test\.(?:tsx?|[cm]?js)$/.test(file) ||
      relative(props.root, file).split(sep)[0] === "tests"
    )
      continue
    const stem = file.replace(/\.test\.(?:tsx?|[cm]?js)$/, "")
    if (
      ![".ts", ".tsx", ".js", ".mjs", ".cjs"].some((extension) =>
        files.has(stem + extension)
      )
    )
      problems.push(
        `${relative(props.root, file)}: 単体テストは同名の実装の隣、横断テストはtests/に置く`
      )
  }
  return problems
}
