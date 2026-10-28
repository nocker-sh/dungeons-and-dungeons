import { sourceLayoutProblems } from "@/scripts/source-layout-problems"
import ts from "typescript"
import { exportedFunctionNames } from "@/scripts/exported-function-names"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { sourceProblems } from "@/scripts/source-problems"

/** 依存物・生成物・画像の保管場所を除き、ソースの実体を検査する。 */
export function repositorySourceProblems(root: string) {
  const skipped = new Set([
    "node_modules",
    ".git",
    ".void",
    ".wrangler",
    ".claude",
    "dist",
    "public",
    ".docs",
  ])
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (skipped.has(entry.name)) return []
      const file = join(dir, entry.name)
      if (entry.isDirectory()) return files(file)
      return /\.(?:tsx?|m?js|cjs)$/.test(entry.name) ? [file] : []
    })
  const sourceFiles = files(root)
  const problems = [
    ...sourceLayoutProblems({ root, files: sourceFiles }),
    ...sourceFiles.flatMap((file) =>
      sourceProblems(relative(root, file), readFileSync(file, "utf8"))
    ),
  ]
  const config = ts.readConfigFile(join(root, "tsconfig.json"), (file) =>
    ts.sys.readFile(file)
  )
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  const checker = program.getTypeChecker()
  for (const file of sourceFiles) {
    const source = program.getSourceFile(file)
    if (!source) continue
    const module = checker.getSymbolAtLocation(source)
    if (
      !module ||
      checker
        .getExportsOfModule(module)
        .filter((entry) => entry.valueDeclaration).length < 2
    )
      continue
    const functions = exportedFunctionNames(checker, source)
    if (functions.length > 1)
      problems.push(
        `${relative(root, file)}:1: 1ファイルからexportする関数は1つまで: ${functions.join(", ")}`
      )
  }
  return problems
}
