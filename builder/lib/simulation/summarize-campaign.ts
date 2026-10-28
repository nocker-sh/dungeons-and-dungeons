import { buildContent } from "@/builder/lib/build-content"
import { rate } from "@/builder/lib/simulation/rate"
import { median } from "@/builder/lib/simulation/median"
import { mean } from "@/builder/lib/simulation/mean"
import type {
  CampaignOptions,
  CampaignRun,
} from "@/builder/lib/simulation/campaign"
import { perBattle } from "@/builder/lib/simulation/per-battle"

/** 一周の回ごとの記録をまとめる。 */
export function summarizeCampaign(
  built: ReturnType<typeof buildContent>,
  options: Pick<CampaignOptions, "layers">,
  runs: readonly CampaignRun[]
) {
  const layerCount = Math.min(options.layers, built.content.layers.length)
  const layers = Array.from({ length: layerCount }, (_, index) => {
    const at = runs
      .map((entry) => entry.clearedAt[index])
      .filter((value): value is number => value !== null)
    const levels = runs
      .map((entry) => entry.levelAt[index])
      .filter((value): value is number => value !== null)
    return {
      layer: built.slugs.get(built.content.layers[index].id) ?? String(index),
      clear: rate(at.length, runs.length),
      medianTrip: median(at),
      level: mean(levels),
      companionLevel: mean(
        runs
          .map((entry) => entry.companionLevelAt[index])
          .filter((value): value is number => value !== null)
      ),
    }
  })
  const trips = runs.reduce((sum, entry) => sum + entry.expeditions, 0)
  const rareAt = runs
    .map((entry) => entry.firstRareAt)
    .filter((value): value is number => value !== null)
  return {
    layers,
    wipes: mean(runs.map((entry) => entry.wipes)),
    bossWipes: mean(runs.map((entry) => entry.bossWipes)),
    expeditions: mean(runs.map((entry) => entry.expeditions)),
    finalLevel: mean(runs.map((entry) => entry.finalLevel)),
    finalCompanionLevel: mean(runs.map((entry) => entry.finalCompanionLevel)),
    finalGold: mean(runs.map((entry) => entry.finalGold)),
    /** 1回の出撃あたりの鑑定の回数と、鑑定があった出撃の割合。 */
    appraisalsPerTrip: trips
      ? runs.reduce((sum, entry) => sum + entry.appraisals, 0) / trips
      : 0,
    appraiseTripRate: rate(
      runs.reduce((sum, entry) => sum + entry.appraiseTrips, 0),
      trips
    ),
    /** はじめて R 以上を引くまでの出撃回数（中央値）と、引けた割合。 */
    firstRareTrip: median(rareAt),
    firstRareRate: rate(rareAt.length, runs.length),
    /** 道中の戦闘とボス戦の、1戦あたりのラウンド（戦闘のテンポ）。 */
    battleRounds: perBattle(runs, "battleRounds", "battles"),
    bossRounds: perBattle(runs, "bossRounds", "bossBattles"),
    /** 1回の出撃あたりの修理代と稼ぎ。 */
    repairPerTrip: trips
      ? runs.reduce((sum, entry) => sum + entry.repairGold, 0) / trips
      : 0,
    earnedPerTrip: trips
      ? runs.reduce((sum, entry) => sum + entry.earnedGold, 0) / trips
      : 0,
  }
}
