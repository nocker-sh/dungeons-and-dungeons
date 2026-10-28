import { sluggedEntries } from "@/lib/wiz/testing/real-content"

export const allSlugs = new Map<string, string>(
  Object.values(sluggedEntries).flatMap((entries) =>
    entries.flatMap((entry) =>
      entry.slug ? [[entry.slug, entry.id] as const] : []
    )
  )
)

/**
 * 人が読める名前（slug）から id。作品データ全体で slug は重ならないので種類は要らない。
 * エンジンへ送る操作や、状態・出来事と比べる id はこれで書く（テストに uuid を書かない）。
 */
export function contentId(slug: string): string {
  const found = allSlugs.get(slug)
  if (!found) throw new Error(`作品データに ${slug} がない`)
  return found
}
