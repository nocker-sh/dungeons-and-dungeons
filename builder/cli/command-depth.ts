import { depthTrials } from "@/builder/lib/simulation/depth-trials"
import type { CliOptions } from "@/builder/cli/options"
import { formatPercent } from "@/builder/cli/format-percent"
import { formatNumber } from "@/builder/cli/format-number"
import { printResult } from "@/builder/cli/print-result"

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
