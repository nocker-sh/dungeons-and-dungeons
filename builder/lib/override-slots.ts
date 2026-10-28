import type { Source, Entry } from "@/builder/lib/content"
import { COLLECTIONS } from "@/builder/lib/content"
import { get } from "@/builder/lib/get"
import { collection } from "@/builder/lib/collection"

/** 上書きが書き換える場所。`*` なら複数になる。 */
export type OverrideSlot = { parent: Record<string, unknown>; key: string }

/** 上書きのパスが指す場所。見つからなければ投げる。 */
export function overrideSlots(
  source: Source,
  pathText: string
): OverrideSlot[] {
  const path = pathText.trim().split(".")
  const listName = COLLECTIONS.find((name) => pathText.startsWith(`${name}.`))
  const slots: OverrideSlot[] = []
  const reach = (root: unknown, rest: readonly string[]) => {
    const parent = get(root, rest.slice(0, -1))
    if (!parent || typeof parent !== "object")
      throw new Error(`項目が見つからない: ${pathText}`)
    slots.push({
      parent: parent as Record<string, unknown>,
      key: rest[rest.length - 1],
    })
  }
  if (listName) {
    const depth = listName.split(".").length
    const key = path[depth]
    const rest = path.slice(depth + 1)
    const entries = collection(source, listName).filter(
      (entry) =>
        key === "*" ||
        entry.id === key ||
        entry.slug === key ||
        (entry.member as Entry | undefined)?.slug === key
    )
    if (!entries.length) throw new Error(`${listName} に ${key} がない`)
    for (const entry of entries) reach(entry, rest)
  } else reach(source, path)
  return slots
}
