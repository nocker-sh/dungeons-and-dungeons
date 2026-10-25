import { judge, type Target } from "../targets"
import { ResultCache } from "../lib/result-cache"
import type { CliOptions } from "./options"
import { formatPercent, formatNumber, printResult } from "./output"
import { chooseTargets } from "./targets"
import { commandBattle, commandCurve } from "./battle"
import { commandDungeon, commandCampaign } from "./expedition"

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

/** 一つの数値を振って、指標を並べる。 */
export async function commandSweep(options: CliOptions) {
  if (!options.parameterPath || !options.values.length)
    throw new Error("--param <path> --values a,b,c が要る")
  const metric = options.metric ?? "report"
  for (const value of options.values) {
    const overrides = [
      ...options.overrides,
      `${options.parameterPath}=${value}`,
    ]
    const local = { ...options, overrides, json: false }
    process.stdout.write(`--- ${options.parameterPath}=${value}\n`)
    if (metric === "report") await commandReport(local, false)
    else if (metric.startsWith("battle:")) {
      local.positional = [metric.slice(7)]
      commandBattle(local)
    } else if (metric.startsWith("dungeon:")) {
      local.positional = [metric.slice(8)]
      commandDungeon(local)
    } else if (metric.startsWith("curve:")) {
      local.positional = [metric.slice(6)]
      commandCurve(local)
    } else if (metric === "campaign") commandCampaign(local)
    else throw new Error(`知らない指標: ${metric}`)
  }
}
