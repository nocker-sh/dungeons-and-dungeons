import { battleTrials } from "@/builder/lib/simulation/battle-trials"
import type { CliOptions } from "@/builder/cli/options"
import { formatPercent } from "@/builder/cli/format-percent"
import { formatNumber } from "@/builder/cli/format-number"
import { formatRate } from "@/builder/cli/format-rate"
import { printResult } from "@/builder/cli/print-result"

export function commandBattle(options: CliOptions) {
  const foes = (options.positional[0] ?? "hiyokobu").split(",")
  const result = battleTrials({
    overrides: options.overrides,
    foes,
    boss: options.boss,
    runs: options.runs,
    seed: options.seed,
    style: options.style,
    setup: {
      level: options.level,
      weapons: options.weapons,
      reached: options.reached,
    },
  })
  printResult(options, result, () =>
    [
      `戦闘 ${foes.join(" + ")}${options.boss ? "（ボス）" : ""} Lv${options.level ?? "初期"} 方針${options.style} ${options.runs}回`,
      `  勝率 ${formatRate(result.win)}  平均ラウンド ${formatNumber(result.rounds)}  残りHP ${formatPercent(result.hpLeft)}  倒れた人数 ${formatNumber(result.downs, 2)}`,
      `  与えた被害/戦: ${Object.entries(result.damage)
        .map(([who, value]) => `${who} ${formatNumber(value, 0)}`)
        .join("  ")}`,
      `  回復/戦: ${
        Object.entries(result.healing)
          .map(([who, value]) => `${who} ${formatNumber(value, 0)}`)
          .join("  ") || "なし"
      }`,
      `  受けた被害/戦: ${Object.entries(result.taken)
        .map(([who, value]) => `${who} ${formatNumber(value, 0)}`)
        .join("  ")}`,
      `  使った手/戦: ${Object.entries(result.uses)
        .slice(0, 14)
        .map(([what, value]) => `${what} ${formatNumber(value)}`)
        .join("  ")}`,
    ].join("\n")
  )
}
