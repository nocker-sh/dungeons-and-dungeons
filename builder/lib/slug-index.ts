import type { Source, Entry } from "@/builder/lib/content"

/** id → slug（全一覧と入れ子の仲間）。 */
export function slugIndex(source: Source) {
  const slugs = new Map<string, string>()
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (!value || typeof value !== "object") return
    const entry = value as Entry
    if (typeof entry.id === "string" && typeof entry.slug === "string")
      slugs.set(entry.id, entry.slug)
    for (const item of Object.values(entry)) walk(item)
  }
  walk(source)
  return slugs
}
