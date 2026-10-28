import { sluggedEntries } from "@/lib/wiz/testing/real-content"

export const idToSlug = new Map<string, string>(
  Object.values(sluggedEntries).flatMap((entries) =>
    entries.map((entry) => [entry.id, entry.slug ?? entry.id] as const)
  )
)

/** id から人が読める名前。失敗の読みやすさのために使う。 */
export function slugOfId(id: string): string {
  return idToSlug.get(id) ?? id
}
