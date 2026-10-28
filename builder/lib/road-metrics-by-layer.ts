import { mean } from "@/builder/lib/simulation/mean"
import type { Playthrough, Trip } from "@/builder/lib/fun"

/** 層ごとの道中戦。戦闘数で集計し、出撃ごとの平均を再平均しない。 */
export function roadMetricsByLayer(playthroughs: readonly Playthrough[]) {
  const layers = new Map<string, { name: string; trips: Trip[] }>()
  for (const run of playthroughs)
    for (const trip of run.trips) {
      const layer = layers.get(trip.layer) ?? {
        name: trip.layerName,
        trips: [],
      }
      layer.trips.push(trip)
      layers.set(trip.layer, layer)
    }
  return [...layers].map(([layer, { name, trips }]) => {
    const fights = trips.flatMap((trip) =>
      trip.result.fights.filter((fight) => !fight.boss)
    )
    const actions = fights
      .map((fight) => fight.actions)
      .sort((left, right) => left - right)
    const middle = Math.floor(actions.length / 2)
    return {
      layer,
      name,
      trips: trips.length,
      fights: fights.length,
      normalFights: fights.filter((fight) => !fight.midboss).length,
      normalActionsPerFight: fights.some((fight) => !fight.midboss)
        ? mean(
            fights
              .filter((fight) => !fight.midboss)
              .map((fight) => fight.actions)
          )
        : null,
      midbossFights: fights.filter((fight) => fight.midboss).length,
      midbossActionsPerFight: fights.some((fight) => fight.midboss)
        ? mean(
            fights
              .filter((fight) => fight.midboss)
              .map((fight) => fight.actions)
          )
        : null,
      actionsPerFight: fights.length ? mean(actions) : null,
      medianActions: fights.length
        ? actions.length % 2
          ? actions[middle]
          : (actions[middle - 1] + actions[middle]) / 2
        : null,
      maxActions: fights.length ? actions[actions.length - 1] : null,
      easyFights: fights.length
        ? fights.filter((fight) => fight.start - fight.lowest < 0.1).length /
          fights.length
        : null,
    }
  })
}
