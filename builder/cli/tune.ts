import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { formatKnobValue } from "@/builder/lib/tuning/format-knob-value"
import { rangeText } from "@/builder/lib/tuning/range-text"
import { tune } from "@/builder/lib/tune"
import type { TuneResult } from "@/builder/lib/tuning/types"
import { knobBaseReader } from "@/builder/lib/knob-base-reader"
import { loadTuningSpec } from "@/builder/lib/load-tuning-spec"
import type { CliOptions } from "@/builder/cli/options"
import { formatPercent } from "@/builder/cli/format-percent"
import { formatNumber } from "@/builder/cli/format-number"
import { chooseTargets } from "@/builder/cli/targets"
import { commandApply } from "@/builder/cli/apply"

/** tune の結果を表にする。 */
function tuneReport(result: TuneResult): string {
  const show = (unit: string, value: number) =>
    !Number.isFinite(value)
      ? "届かない"
      : unit === "rate"
        ? formatPercent(value)
        : formatNumber(value)
  const lines = [
    `${"目標".padEnd(16)}${"いま".padStart(9)}${"調整後".padStart(10)}  ${"範囲".padEnd(16)}判定`,
    ...result.metrics.map(
      (metric) =>
        `${metric.id.padEnd(16)}${show(metric.unit, metric.before).padStart(9)}${show(metric.unit, metric.after).padStart(10)}  ${rangeText(metric).padEnd(16)}${metric.okAfter ? "PASS" : "FAIL"}${metric.okBefore && !metric.okAfter ? "（悪化）" : ""}`
    ),
  ]
  lines.push(
    result.changes.length
      ? `動かした数値 ${result.changes.length}個`
      : "動かした数値はない"
  )
  for (const change of result.changes)
    lines.push(
      `  ${change.label}: ${formatKnobValue(change.from)} → ${formatKnobValue(change.to)}`
    )
  return lines.join("\n")
}

const STOP_TEXT: Record<TuneResult["stop"], string> = {
  already: "すでに全ての目標が範囲の中",
  passed: "全ての目標が範囲に入った",
  budget: "測定の上限に達した（--budget を増やす）",
  "no-progress": "これ以上よくなる向きが見つからない（つまみの範囲を広げる）",
}

/** 目標から外れた数値を、つまみを動かして範囲へ入れる。 */
export async function commandTune(options: CliOptions) {
  const file = options.positional[0]
  if (!file)
    throw new Error("調整の指定が要る（例: builder/tunings/layer0.ts）")
  const spec = await loadTuningSpec(file)
  const targets = chooseTargets(options, spec.targets)
  const seeds = options.seeds?.length ? options.seeds : [1, 7, 23]
  const runs = options.runsGiven ? options.runs : 30
  const budget = options.budget ?? 60
  const started = Date.now()
  const result = tune({
    spec,
    targets,
    baseOverrides: options.overrides,
    baseValue: knobBaseReader(options.overrides),
    seeds,
    budget,
    measure: ({ overrides, seed }) =>
      Object.fromEntries(
        targets.map((target) => [
          target.id,
          target.measure({ overrides, runs, seed }),
        ])
      ),
    // 進み具合は標準エラーへ。--json の出力を汚さない。
    onProgress: (line) => process.stderr.write(`${line}\n`),
  })
  const seconds = (Date.now() - started) / 1000
  const outputPath =
    options.outputPath ?? `node_modules/.cache/builder/tune-${spec.id}.txt`
  let written: string | undefined
  if (result.changes.length) {
    const lines = [
      `# vp run cli tune ${file} が作った上書き`,
      `# ${spec.label ?? spec.id} / 種 ${seeds.join(",")} / --runs ${runs} / 測定${result.measurements}回`,
      `# 当てる: vp run cli apply --sets ${outputPath}`,
      ...(options.overrides.length
        ? ["# 呼び出し時の --set", ...options.overrides]
        : []),
      "# 調整で動かした数値",
      ...result.overrides,
    ]
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${lines.join("\n")}\n`)
    written = outputPath
  }
  if (options.json)
    console.log(
      JSON.stringify(
        {
          spec: spec.id,
          runs,
          seeds,
          budget,
          seconds,
          setsFile: written,
          ...result,
        },
        null,
        2
      )
    )
  else
    console.log(
      [
        tuneReport(result),
        `${STOP_TEXT[result.stop]}（測定${result.measurements}回・使い回し${result.cacheHits}回・反復${result.iterations}回・${seconds.toFixed(1)}秒）`,
        written
          ? `上書きを書き出した: ${written}\n当てる: vp run cli apply --sets ${written}`
          : "書き戻すものはない",
      ].join("\n")
    )
  if (result.changes.length && options.apply) {
    if (!result.passed)
      throw new Error(
        "目標に届いていないので書き戻さない（--apply を外して確かめる）"
      )
    commandApply({
      ...options,
      overrides: [...options.overrides, ...result.overrides],
    })
  }
  if (!result.passed) process.exitCode = 1
}
