/**
 * 測る回数を合否が決まるところまでに抑える（逐次検定）。
 * 結果の95%の幅が目標の内側か外側に収まったら打ち切る。判定の基準（目標の範囲）は変えない。
 */
export type Range = { min?: number; max?: number }

/** 幅が目標の範囲の内側に収まったか、外側へ出きったか（どちらでも合否は決まる）。 */
export function settled(interval: { low: number; high: number }, range: Range) {
  const min = range.min ?? -Infinity
  const max = range.max ?? Infinity
  const inside = interval.low >= min && interval.high <= max
  const below = interval.high < min
  const above = interval.low > max
  return inside || below || above
}
