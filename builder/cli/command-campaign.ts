import { campaignTrials } from "@/builder/lib/simulation/campaign-trials"
import type { CliOptions } from "@/builder/cli/options"
import { formatPercent } from "@/builder/cli/format-percent"
import { formatNumber } from "@/builder/cli/format-number"
import { formatRate } from "@/builder/cli/format-rate"
import { printResult } from "@/builder/cli/print-result"

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
          `  ${layer.layer}: 突破 ${formatRate(layer.clear)}  突破までの出撃 中央値 ${formatNumber(layer.medianTrip)}  突破時の仲間平均Lv ${formatNumber(layer.companionLevel)}（全員 ${formatNumber(layer.level)}）`
      ),
      `  全滅 平均${formatNumber(result.wipes, 2)}回（うちボス戦 ${formatNumber(result.bossWipes, 2)}）  出撃 平均${formatNumber(result.expeditions)}回  最後の仲間平均Lv ${formatNumber(result.finalCompanionLevel)}（全員 ${formatNumber(result.finalLevel)}）  所持金 ${formatNumber(result.finalGold, 0)}`,
      `  鑑定 1出撃あたり${formatNumber(result.appraisalsPerTrip, 2)}回（鑑定があった出撃 ${formatPercent(result.appraiseTripRate.p)}）  はじめてのR以上 ${formatNumber(result.firstRareTrip)}回目（${formatPercent(result.firstRareRate.p)}が到達）`,
      `  1戦あたりのラウンド 道中${formatNumber(result.battleRounds, 1)}  ボス${formatNumber(result.bossRounds, 1)}`,
      `  1出撃あたり 稼ぎ${formatNumber(result.earnedPerTrip, 0)}G  修理代${formatNumber(result.repairPerTrip, 0)}G（稼ぎの${formatPercent(result.earnedPerTrip ? result.repairPerTrip / result.earnedPerTrip : 0)}）`,
    ].join("\n")
  )
}
