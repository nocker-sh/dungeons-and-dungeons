export const formatPercent = (value: number) =>
  Number.isNaN(value) ? "-" : `${(value * 100).toFixed(1)}%`
