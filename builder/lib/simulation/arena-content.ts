import { applyOverride } from "@/builder/lib/apply-override"
import { cloneSource } from "@/builder/lib/clone-source"
import { idOf } from "@/builder/lib/id-of"
import { slugIndex } from "@/builder/lib/slug-index"
import type { Built } from "@/builder/lib/build-content"
import { toGameContent } from "@/content/game-content"

/** 戦いたい敵だけの層（闘技場）を先頭に足したデータ。 */
export function arenaContent(
  overrides: readonly string[],
  foes: readonly string[],
  boss: boolean
): Built {
  const source = cloneSource()
  for (const expression of overrides) applyOverride(source, expression)
  const ids = foes.map((key) => {
    const id = idOf(source, key, "foes")
    if (!id) throw new Error(`敵 ${key} がない`)
    return id
  })
  const layers = source.layers as Record<string, unknown>[]
  layers.unshift({
    id: "arena",
    slug: "arena",
    no: 0,
    name: "闘技場",
    foes: ids,
    group: [ids.length, ids.length],
    boss: ids[0],
    start: "s",
    stations: [
      { id: "s", x: 0, y: 0, next: ["n1"] },
      boss
        ? { id: "n1", x: 1, y: 0, next: [], boss: true }
        : { id: "n1", x: 1, y: 0, next: ["n2"], event: "battle" },
      ...(boss ? [] : [{ id: "n2", x: 2, y: 0, next: [], boss: true }]),
    ],
    weights: { battle: 1, treasure: 0, trap: 0 },
    treasure: { gold: [0, 0], goods: [] },
    trap: [0, 0],
  })
  source.reached = 0
  return { source, content: toGameContent(source), slugs: slugIndex(source) }
}
