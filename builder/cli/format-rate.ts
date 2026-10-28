import { formatPercent } from "@/builder/cli/format-percent"

export const formatRate = (entry: { p: number; margin: number }) =>
  `${formatPercent(entry.p)} ±${(entry.margin * 100).toFixed(1)}`
