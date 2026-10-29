import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { documentLinkProblems } from "@/scripts/document-link-problems"

export async function checkDocs(root: string): Promise<string[]> {
  const problems: string[] = []
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (/\.(?:md|json)$/.test(entry.name))
        problems.push(
          ...documentLinkProblems({
            root,
            file: relative(root, file),
            source: await readFile(file, "utf8"),
          })
        )
    }
  }
  await visit(join(root, ".docs"))
  if (existsSync(join(root, "concept/lore")))
    await visit(join(root, "concept/lore"))
  return problems
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const problems = await checkDocs(resolve(process.argv[2] ?? "."))
  if (problems.length) {
    console.error(problems.join("\n"))
    process.exitCode = 1
  } else console.log("資料: Wikiリンクと参照先の検査 PASS")
}
