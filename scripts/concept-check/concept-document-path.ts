import { dirname, resolve } from "node:path"

/** Wikiリンクは.docsを基準にし、旧形式は既存資料の読み取りに限って受け付ける。 */
export function conceptDocumentPath(
  root: string,
  origin: string,
  reference: string
): string {
  const wiki = /^\[\[concept\/([^|#]+)(?:\|[^\]]+)?\]\]$/.exec(reference)
  if (wiki) {
    const target = wiki[1].endsWith(".md") ? wiki[1] : `${wiki[1]}.md`
    return resolve(root, target)
  }
  return resolve(root, dirname(origin), reference)
}
