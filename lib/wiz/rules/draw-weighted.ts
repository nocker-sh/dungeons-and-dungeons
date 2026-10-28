import type { Random } from "@/lib/wiz/rules/random"
import { pickWeighted } from "@/lib/wiz/rules/pick-weighted"

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
