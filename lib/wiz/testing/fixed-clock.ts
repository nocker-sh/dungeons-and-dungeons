/** いつ呼んでも同じ時刻を返す時計。 */
export function fixedClock(at = 0) {
  return () => at
}
