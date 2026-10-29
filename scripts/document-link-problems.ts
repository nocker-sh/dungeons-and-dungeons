import { documentAnchorProblems } from "@/scripts/document-anchor-problems"
import { existsSync, readFileSync } from "node:fs"
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
      target.startsWith("tmp/") ||
      /^(?:private|node_modules|dist|dist-ssr|\.git|\.claude|\.void|\.wrangler)(?:\/|$)/.test(
        target
      ) ||
      /^\.env(?:\.|$)/.test(target)
    ) {
      problems.push(
        `${props.file}: Wikiリンクに相対移動・一時パスを使わない ${target}`
      )
      continue
    }
    const file = [
      resolve(props.root, ".docs", target),
      resolve(props.root, ".docs", `${target}.md`),
      resolve(props.root, target),
      resolve(props.root, `${target}.md`),
    ].find((file) => existsSync(file))
    if (!file) problems.push(`${props.file}: Wikiリンクの対象がない ${target}`)
    const anchor = match[1].split("|")[0].split("#").slice(1).join("#")
    if (file?.endsWith(".md") && anchor)
      problems.push(
        ...documentAnchorProblems({
          file: props.file,
          source: readFileSync(file, "utf8"),
          anchor,
        })
      )
  }
  return problems
}
