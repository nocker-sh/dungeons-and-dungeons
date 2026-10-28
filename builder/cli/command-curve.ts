import { levelFor } from "@/builder/lib/simulation/level-for"
import type { CliOptions } from "@/builder/cli/options"
import { formatPercent } from "@/builder/cli/format-percent"
import { printResult } from "@/builder/cli/print-result"

export function commandCurve(options: CliOptions) {
  const foes = (options.positional[0] ?? "haribote-adult").split(",")
  const result = levelFor({
    overrides: options.overrides,
    foes,
    boss: options.boss,
    runs: options.runs,
    seed: options.seed,
    style: options.style,
    threshold: 0.5,
    from: 3,
    to: 20,
    weapons: options.weapons,
  })
  printResult(options, result, () =>
    [
      `レベルと勝率 ${foes.join(" + ")}${options.boss ? "（ボス）" : ""}（勝率50%に届くのは Lv${result.level ?? "20超"}）`,
      ...result.curve.map(
        (entry) => `  Lv${entry.level} ${formatPercent(entry.win)}`
      ),
    ].join("\n")
  )
}
