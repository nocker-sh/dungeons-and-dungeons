import type { Source, Entry } from "@/builder/lib/content"
import { COLLECTIONS } from "@/builder/lib/content"
import { collection } from "@/builder/lib/collection"

/** slug（または id）から id。見つからなければ undefined。 */
export function idOf(source: Source, key: string, kind?: string) {
  const names = kind ? [kind] : COLLECTIONS
  for (const name of names)
    for (const entry of collection(source, name)) {
      if (entry.id === key || entry.slug === key) return entry.id
      const member = entry.member as Entry | undefined
      if (member && (member.id === key || member.slug === key)) return member.id
    }
  return undefined
}
