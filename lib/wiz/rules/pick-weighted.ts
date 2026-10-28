import type { Random } from "@/lib/wiz/rules/random"

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
