import { places, tuning } from "@/content/looks/data"
import type { Stand } from "@/content/looks/types"

/** 店主・案内人の立ち位置と大きさ。背景の床・カウンターに合わせて場所のデータに持つ。 */
export function standOf(
  key: string,
  wide: boolean,
  index = 0
): Stand | undefined {
  const place = places.get(tuning.places[key] ?? key)
  return (wide ? place?.stands?.wide : place?.stands?.narrow)?.[index]
}
