import { DEFAULT_PLAN } from "@/builder/lib/policy/expedition"
import { townDay } from "@/builder/lib/policy/town"
import type { BattleStyle } from "@/builder/lib/policy/battle"
import { Session } from "@/builder/lib/session"
import { partyLevels } from "@/builder/lib/party-levels"
import { buildContent } from "@/builder/lib/build-content"
import { runExpedition } from "@/builder/lib/simulation/expedition"
import type { Playthrough, Trip } from "@/builder/lib/fun"
import { attackOf } from "@/builder/lib/attack-of"

/** 一周を遊ぶ。踏破するか、出撃の上限まで。 */
export function playthrough(options: {
  overrides: readonly string[]
  seed: number
  trips: number
  style: BattleStyle
}): Playthrough {
  const built = buildContent(options.overrides)
  const session = new Session(built, options.seed)
  const layers = built.content.layers
  const cleared = new Set<string>()
  const trips: Trip[] = []
  let lostAt = -Infinity
  let endingAt: number | null = null
  for (let no = 1; no <= options.trips; no++) {
    const attackBefore = attackOf(session)
    const day = townDay(session, {
      potions: 2,
      upgrade: true,
      summon: true,
      shop: true,
    })
    if (!session.queries.readiness(session.state).ready) continue
    const attackAfter = attackOf(session)
    const levels = partyLevels(session)
    const result = runExpedition(
      session,
      day.layer,
      { ...DEFAULT_PLAN, avoidBoss: levels.all < lostAt + 1 },
      options.style
    )
    if (result.bossReached && !result.bossWon) lostAt = partyLevels(session).all
    const firstClear =
      result.outcome === "cleared" && !cleared.has(day.layer) ? day.layer : null
    if (firstClear) cleared.add(firstClear)
    const layer = layers.find((entry) => entry.id === day.layer)
    trips.push({
      no,
      layer: built.slugs.get(day.layer) ?? day.layer,
      layerName: layer?.name ?? day.layer,
      appraised: day.appraised,
      attackBefore,
      attackAfter,
      levelBefore: levels.all,
      companionLevelBefore: levels.companions,
      result,
      firstClear: firstClear ? (layer?.name ?? firstClear) : null,
    })
    if (firstClear && layers[layers.length - 1].id === firstClear) {
      endingAt = no
      break
    }
  }
  return { trips, endingAt }
}
