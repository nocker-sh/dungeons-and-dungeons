import type { ContentKind } from "@/lib/wiz/testing/real-content"
import { sluggedEntries } from "@/lib/wiz/testing/real-content"

export const slugToId = new Map<ContentKind, Map<string, string>>(
  Object.entries(sluggedEntries).map(([kind, entries]) => [
    kind as ContentKind,
    new Map(entries.map((entry) => [entry.slug ?? entry.id, entry.id])),
  ])
)

/**
 * 人が読める名前（slug）から id。すでに id ならそのまま返す。
 * 組み立て器（`aState()`・`aContent()`）が内側で使い、テストに uuid を書かせない。
 */
export function idOfSlug(kind: ContentKind, key: string): string {
  return slugToId.get(kind)?.get(key) ?? key
}
