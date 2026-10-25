/**
 * 測る回数を合否が決まるところまでに抑える（逐次検定）。
 * 結果の95%の幅が目標の内側か外側に収まったら打ち切る。判定の基準（目標の範囲）は変えない。
 */
export type Range = { min?: number; max?: number }

/** 最初にまとめて回す回数と、途中で決めるか確かめる間隔。 */
export const FIRST_LOOK = 20
export const LOOK_EVERY = 10

/** 率の95%の幅（Wilson）。0%・100%でも幅を持つので、少ない回数で決めつけない。 */
export function rateInterval(hits: number, runs: number) {
  if (!runs) return { low: 0, high: 1 }
  const z = 1.96
  const p = hits / runs
  const denominator = 1 + (z * z) / runs
  const center = (p + (z * z) / (2 * runs)) / denominator
  const half =
    (z * Math.sqrt((p * (1 - p)) / runs + (z * z) / (4 * runs * runs))) /
    denominator
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) }
}

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

/** 幅が目標の範囲の内側に収まったか、外側へ出きったか（どちらでも合否は決まる）。 */
export function settled(interval: { low: number; high: number }, range: Range) {
  const min = range.min ?? -Infinity
  const max = range.max ?? Infinity
  const inside = interval.low >= min && interval.high <= max
  const below = interval.high < min
  const above = interval.low > max
  return inside || below || above
}

/** run 回目（0始まり）を終えたところで、決まったかを確かめる番か。 */
export function lookAt(run: number) {
  const done = run + 1
  return done >= FIRST_LOOK && (done - FIRST_LOOK) % LOOK_EVERY === 0
}
