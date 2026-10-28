import { lines, sayings } from "@/content/looks/data"
import { personOf } from "@/content/looks/person-of"
import { portraitOf } from "@/content/looks/portrait-of"

/** 街の人（店主・受付嬢・番人・案内人）。名前と絵は資料、ひとことは資料＋台本。 */
export type Keeper = { name: string; img: string; lines: string[] }

export function keeperOf(id: string): Keeper {
  const said = sayings(id).map(
    (entry) => `「${entry.text.replace(/^「|」$/g, "")}」`
  )
  const scripted = lines.keepers[id] ?? []
  const all = [...scripted, ...said]
  return {
    name: personOf(id)?.name ?? id,
    img: portraitOf(id),
    lines: all.length ? all : ["「……」"],
  }
}
