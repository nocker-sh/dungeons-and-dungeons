type Props = { file: string; source: string; anchor: string }

/** Wikiリンクが指す見出しが一意に残っていることを確かめる。 */
export function documentAnchorProblems(props: Props): string[] {
  const source = props.source.replace(/```[^\n]*\n[\s\S]*?```/g, "")
  const headings = [...source.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)]
  const matches = headings.filter(
    (match) => match[1].replace(/[`*_]/g, "").trim() === props.anchor
  )
  return matches.length === 1
    ? []
    : [`${props.file}: Wikiリンクの見出しが一意に存在しない ${props.anchor}`]
}
