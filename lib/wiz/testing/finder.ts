import type { ContentKind } from "@/lib/wiz/testing/real-content"
import { idOfSlug } from "@/lib/wiz/testing/id-of-slug"

export function finder<T extends { id: string }>(
  kind: ContentKind,
  list: readonly T[]
) {
  return (key: string): T => {
    const id = idOfSlug(kind, key)
    const found = list.find((entry) => entry.id === id)
    if (!found) throw new Error(`作品データに ${kind} の ${key} がない`)
    return found
  }
}
