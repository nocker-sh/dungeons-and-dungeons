/** 平均の95%の幅。 */
export function meanInterval(values: readonly number[]) {
  const n = values.length
  if (n < 2) return { low: -Infinity, high: Infinity }
  const mean = values.reduce((sum, value) => sum + value, 0) / n
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
  const half = 1.96 * Math.sqrt(variance / n)
  return { low: mean - half, high: mean + half }
}
