import { existsSync } from "node:fs"
import { resolve } from "node:path"

type Props = { root: string; file: string; source: string }

/** 資料のリンクはWiki形式とし、消えた資料や一時パスを参照しない。 */
export function documentLinkProblems(props: Props): string[] {
  const source = props.source.replace(/```[^\n]*\n[\s\S]*?```/g, "")
  const problems: string[] = []
  if (/!?\[[^\]\n]*\]\([^\n)]*\)/.test(source))
    problems.push(`${props.file}: 文書への参照はWikiリンクで書く`)
  for (const match of source.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const target = match[1].split("|")[0].split("#")[0]
    if (/^(?:https?:\/\/|mailto:)/.test(target)) continue
    if (
      !target ||
      target.startsWith("/") ||
      target.split("/").some((part) => part === "." || part === "..") ||
      target.startsWith("public/tmp/") ||
      target.startsWith("tmp/")
    ) {
      problems.push(
        `${props.file}: Wikiリンクに相対移動・一時パスを使わない ${target}`
      )
      continue
    }
    if (
      ![
        resolve(props.root, ".docs", target),
        resolve(props.root, ".docs", `${target}.md`),
        resolve(props.root, target),
        resolve(props.root, `${target}.md`),
      ].some((file) => existsSync(file))
    )
      problems.push(`${props.file}: Wikiリンクの対象がない ${target}`)
  }
  return problems
}
