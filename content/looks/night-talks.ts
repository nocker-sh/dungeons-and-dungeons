import { lines } from "@/content/looks/data"
import type { NightTalk } from "@/content/looks/types"
import { named } from "@/content/looks/named"

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
