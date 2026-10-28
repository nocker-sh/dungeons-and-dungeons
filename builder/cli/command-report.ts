import { judge } from "@/builder/targets"
import type { Target } from "@/builder/targets"
import { ResultCache } from "@/builder/lib/result-cache"
import type { CliOptions } from "@/builder/cli/options"
import { formatPercent } from "@/builder/cli/format-percent"
import { formatNumber } from "@/builder/cli/format-number"
import { printResult } from "@/builder/cli/print-result"
import { chooseTargets } from "@/builder/cli/targets"

export async function commandReport(options: CliOptions, strict: boolean) {
  const targets = chooseTargets(options)
  // 同じソース・上書き・回数・種で測った値は使い回す（--no-cache で測り直す）
  const cache = options.cache ? new ResultCache() : null
  const keyOf = (target: Target) => [
    target.id,
    target.min,
    target.max,
    options.overrides,
    options.runs,
    options.seed,
  ]
  const rows = targets.map((target, index) => {
    const progress = `[${index + 1}/${targets.length}] ${target.id}`
    const key = keyOf(target)
    const cached = cache?.get(key)
    if (cached === undefined)
      console.error(`${progress} 測定開始：${target.label}`)
    // 目標の範囲を渡し、合否が決まったところで打ち切る
    const value =
      cached ??
      target.measure({
        overrides: options.overrides,
        runs: options.runs,
        seed: options.seed,
        range: target,
      })
    if (cached === undefined) cache?.set(key, value)
    const ok = judge(target, value)
    console.error(
      `${progress} ${ok ? "PASS" : "FAIL"} ${target.unit === "rate" ? formatPercent(value) : formatNumber(value)}${cached === undefined ? "" : "（前回の結果）"}`
    )
    return { target, value, ok }
  })
  cache?.save()
  const show = (value: number, unit: string) =>
    unit === "rate" ? formatPercent(value) : formatNumber(value)
  printResult(
    options,
    rows.map((row) => ({
      id: row.target.id,
      value: row.value,
      min: row.target.min,
      max: row.target.max,
      ok: row.ok,
    })),
    () =>
      rows
        .map(
          (row) =>
            `${row.ok ? "PASS" : "FAIL"} ${row.target.id.padEnd(15)} ${show(row.value, row.target.unit).padStart(7)}  目標 ${row.target.min !== undefined ? show(row.target.min, row.target.unit) : ""}〜${row.target.max !== undefined ? show(row.target.max, row.target.unit) : ""}  ${row.target.label}`
        )
        .join("\n")
  )
  if (strict && rows.some((row) => !row.ok)) process.exitCode = 1
}
