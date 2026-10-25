import type { CliOptions } from "./options"

export const formatPercent = (value: number) =>
  Number.isNaN(value) ? "-" : `${(value * 100).toFixed(1)}%`

export const formatNumber = (value: number, digits = 1) =>
  Number.isNaN(value) ? "-" : value.toFixed(digits)

export const formatRate = (entry: { p: number; margin: number }) =>
  `${formatPercent(entry.p)} ±${(entry.margin * 100).toFixed(1)}`

export function printResult(
  options: CliOptions,
  data: unknown,
  text: () => string
) {
  console.log(options.json ? JSON.stringify(data, null, 2) : text())
}
