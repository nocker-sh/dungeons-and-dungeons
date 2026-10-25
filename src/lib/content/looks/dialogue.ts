import { lines, sayings } from "./data"
import { personOf, portraitOf } from "./people"
import type { NightTalk } from "./types"

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

export function roomLine(id: string) {
  return lines.rooms[id] ?? ""
}

/** 案内人などの決まり文句。{names} を差し替える。 */
export function guideLine(key: string, names: string[] = []) {
  return (lines.guide[key] ?? "").replace("{names}", names.join("と"))
}

/** 台本の {id} を資料の名前に差し替える（名前が変わっても台本を直さなくてよい）。 */
function named(text: string) {
  return text.replace(
    /\{([\w-]+)\}/g,
    (all, id: string) => personOf(id)?.name ?? all
  )
}

/** 夜の雑談の台本。 */
export function nightTalks(): NightTalk[] {
  return lines.night.map((talk) => ({
    pair: talk.pair,
    lines: talk.lines.map(
      ([who, text, expression]) => [who, named(text), expression] as const
    ),
    choice: {
      ask: named(talk.choice.ask),
      options: talk.choice.options.map(
        ([label, who, reply, expression]) =>
          [named(label), who, named(reply), expression] as const
      ),
    },
  }))
}
