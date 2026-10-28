/** 呼ぶたびに step ミリ秒だけ進む時計。 */
export function advancingClock(from = 0, step = 1000) {
  let now = from
  return () => {
    const value = now
    now += step
    return value
  }
}
