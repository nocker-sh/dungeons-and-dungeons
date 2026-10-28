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
