/** 乱数は必ず呼び出し側（WizWorldEnvironment）から受け取る。 */
export type Random = () => number

export function between(random: Random, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1))
}

export function pick<T>(random: Random, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))]
}

/** 重みつきで一つ選ぶ。 */
export function pickWeighted<T>(
  random: Random,
  list: readonly T[],
  weightOf: (entry: T) => number
): T {
  const total = list.reduce((sum, entry) => sum + weightOf(entry), 0)
  let roll = random() * total
  return (
    list.find((entry) => (roll -= weightOf(entry)) < 0) ?? list[list.length - 1]
  )
}

/** 重みつきで重ならないように count 個選ぶ。 */
export function drawWeighted<T>(
  random: Random,
  list: readonly T[],
  count: number,
  weightOf: (entry: T) => number
): T[] {
  const rest = [...list]
  const drawn: T[] = []
  while (drawn.length < count && rest.length) {
    const entry = pickWeighted(random, rest, weightOf)
    drawn.push(entry)
    rest.splice(rest.indexOf(entry), 1)
  }
  return drawn
}
