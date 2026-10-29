/** メタデータのWikiリンクから正本のパスを取り出す。旧形式の読み取りも保つ。 */
export function referenceTarget(reference: string): string {
  return /^\[\[([^|#\]]+)(?:\|[^\]]+)?\]\]$/.exec(reference)?.[1] ?? reference
}
