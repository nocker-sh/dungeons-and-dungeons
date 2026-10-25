import { campaignTrials, depthTrials, dungeonTrials } from "../lib/simulate"
import type { CliOptions } from "./options"
import { formatPercent, formatNumber, formatRate, printResult } from "./output"

export function commandDungeon(options: CliOptions) {
  const layer = options.positional[0] ?? "layer0"
  const result = dungeonTrials({
    overrides: options.overrides,
    layer,
    runs: options.runs,
    seed: options.seed,
    style: options.style,
    plan: options.plan,
    setup: {
      level: options.level,
      weapons: options.weapons,
      reached: options.reached,
    },
  })
  printResult(options, result, () =>
    [
      `探索 ${layer} Lv${options.level ?? "初期"} ${options.plan.push ? "撤退なし" : `撤退${options.plan.retreatBelow}`} ${options.runs}回`,
      `  突破 ${formatRate(result.clear)}  全滅 ${formatRate(result.wipe)}  撤退 ${formatRate(result.retreat)}`,
      `  ボス到達 ${formatPercent(result.bossReached.p)}  ボス撃破 ${formatPercent(result.bossWon.p)}  進んだ地点 ${formatNumber(result.stations)}  戦闘 ${formatNumber(result.battles)}  金 ${formatNumber(result.gold, 0)}  経験値 ${formatNumber(result.exp, 0)}`,
    ].join("\n")
  )
}

/** どこまで潜るかを変えて、深さごとの稼ぎと危なさを測る（進むほど得かを見る）。 */
export function commandDepth(options: CliOptions) {
  const layer = options.positional[0] ?? "layer0"
  const depths = options.depths ?? [2, 4, 6, 8, 10, 12, 14, 16]
  const result = depthTrials({
    overrides: options.overrides,
    layer,
    depths,
    runs: options.runs,
    seed: options.seed,
    style: options.style,
    setup: {
      level: options.level,
      weapons: options.weapons,
      reached: options.reached,
      potions: options.potions,
    },
  })
  printResult(options, result, () =>
    [
      `深さごとの稼ぎ ${layer} Lv${options.level ?? "初期"} ${options.runs}回`,
      "  引き返す地点  進んだ地点  金貨  経験値  ガラクタ  光る  召喚石  全滅  金/地点  経験値/地点",
      ...result.map(
        (entry) =>
          `  x=${String(entry.depth).padStart(2)}  ${formatNumber(entry.stations)}  ${formatNumber(entry.gold, 0)}  ${formatNumber(entry.exp, 0)}  ${formatNumber(entry.junk, 2)}  ${formatNumber(entry.rareJunk, 2)}  ${formatNumber(entry.stones, 2)}  ${formatPercent(entry.wipe.p)}  ${formatNumber(entry.goldPerStation, 1)}  ${formatNumber(entry.expPerStation, 1)}`
      ),
    ].join("\n")
  )
}

export function commandCampaign(options: CliOptions) {
  const result = campaignTrials({
    overrides: options.overrides,
    runs: options.runs,
    seed: options.seed,
    style: options.style,
    plan: options.plan,
    expeditions: options.expeditions,
    layers: options.layers,
    potions: options.potions,
    shop: options.shop,
  })
  printResult(options, result, () =>
    [
      `一周 ${options.runs}回（出撃${options.expeditions}回まで）`,
      ...result.layers.map(
        (layer) =>
          `  ${layer.layer}: 突破 ${formatRate(layer.clear)}  突破までの出撃 中央値 ${formatNumber(layer.medianTrip)}  突破時の平均Lv ${formatNumber(layer.level)}`
      ),
      `  全滅 平均${formatNumber(result.wipes, 2)}回（うちボス戦 ${formatNumber(result.bossWipes, 2)}）  出撃 平均${formatNumber(result.expeditions)}回  最後の平均Lv ${formatNumber(result.finalLevel)}  所持金 ${formatNumber(result.finalGold, 0)}`,
      `  鑑定 1出撃あたり${formatNumber(result.appraisalsPerTrip, 2)}回（鑑定があった出撃 ${formatPercent(result.appraiseTripRate.p)}）  はじめてのR以上 ${formatNumber(result.firstRareTrip)}回目（${formatPercent(result.firstRareRate.p)}が到達）`,
      `  1戦あたりのラウンド 道中${formatNumber(result.battleRounds, 1)}  ボス${formatNumber(result.bossRounds, 1)}`,
      `  1出撃あたり 稼ぎ${formatNumber(result.earnedPerTrip, 0)}G  修理代${formatNumber(result.repairPerTrip, 0)}G（稼ぎの${formatPercent(result.earnedPerTrip ? result.repairPerTrip / result.earnedPerTrip : 0)}）`,
    ].join("\n")
  )
}
