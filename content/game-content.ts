import conversations from "@/content/data/conversations.json"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import { sourceData } from "@/content/source-data"
import { prepareSource } from "@/content/prepare-source"

/** slug は JSON を人が読むための元の名前。エンジンへは渡さない。 */
function withoutSlug<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutSlug) as T
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "slug")
        .map(([key, entry]) => [key, withoutSlug(entry)])
    ) as T
  return value
}

export const contentSource = { ...prepareSource(sourceData), conversations }
export type ContentSource = typeof contentSource

/** slug を外してエンジンの形にする。中身の検証はエンジン（GameCatalog）が行う。 */
export function toGameContent(source: unknown): GameContent {
  return withoutSlug(source) as GameContent
}

export const gameContent = toGameContent(contentSource)
