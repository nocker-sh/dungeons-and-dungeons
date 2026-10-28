import { dungeonTrials } from "@/builder/lib/simulation/dungeon-trials"
import type { CliOptions } from "@/builder/cli/options"
import { formatPercent } from "@/builder/cli/format-percent"
import { formatNumber } from "@/builder/cli/format-number"
import { formatRate } from "@/builder/cli/format-rate"
import { printResult } from "@/builder/cli/print-result"

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
