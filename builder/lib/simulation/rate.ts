/** 平均・率・95%の幅。 */
export function rate(hits: number, runs: number) {
  const p = runs ? hits / runs : 0
  const margin = runs ? 1.96 * Math.sqrt((p * (1 - p)) / runs) : 0
  return { p, margin }
}
