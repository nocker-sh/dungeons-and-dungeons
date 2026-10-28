import { mean } from "@/builder/lib/simulation/mean"
import { FUN_GOALS } from "@/builder/lib/fun"
import type { Playthrough } from "@/builder/lib/fun"

export type FunMetrics = Record<keyof typeof FUN_GOALS, number>

/** 何周か遊んで、面白さの数字をまとめる。 */
export function funMetrics(playthroughs: readonly Playthrough[]): FunMetrics {
  const trips = playthroughs.flatMap((entry) => entry.trips)
  const fights = trips.flatMap((trip) => trip.result.fights)
  const roads = fights.filter((fight) => !fight.boss)
  const bosses = fights.filter((fight) => fight.boss)
  const rate = (hits: number, total: number) => (total ? hits / total : 0)
  const levelGains = playthroughs.flatMap((entry) =>
    entry.trips
      .slice(1)
      .map(
        (trip, index) =>
          trip.companionLevelBefore - entry.trips[index].companionLevelBefore
      )
  )
  const endings = playthroughs
    .map((entry) => entry.endingAt)
    .filter((value): value is number => value !== null)
  return {
    actionsPerFight: mean(roads.map((fight) => fight.actions)),
    bossRounds: mean(bosses.map((fight) => fight.rounds)),
    strongerTrips: rate(
      trips.filter((trip) => trip.attackAfter > trip.attackBefore).length,
      trips.length
    ),
    hitsPerTrip: rate(
      trips.reduce(
        (sum, trip) =>
          sum +
          trip.appraised.filter((rarity) => rarity === "R" || rarity === "SR")
            .length +
          trip.result.drops,
        0
      ),
      trips.length
    ),
    pinchFights: rate(
      fights.filter((fight) => fight.won && fight.lowest < 0.5).length,
      fights.length
    ),
    easyFights: rate(
      fights.filter((fight) => fight.start - fight.lowest < 0.1).length,
      fights.length
    ),
    wipeTrips: rate(
      trips.filter((trip) => trip.result.outcome === "wiped").length,
      trips.length
    ),
    levelGainPerTrip: mean(levelGains),
    choicesPerTrip: mean(trips.map((trip) => trip.result.choices)),
    earlyWipes: mean(
      playthroughs.map(
        (entry) =>
          entry.trips
            .slice(0, 3)
            .filter((trip) => trip.result.outcome === "wiped").length
      )
    ),
    endingTrips: endings.length
      ? [...endings].sort((a, b) => a - b)[Math.floor(endings.length / 2)]
      : Number.NaN,
  }
}
