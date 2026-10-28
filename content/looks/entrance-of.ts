import { places, tuning } from "@/content/looks/data"

/** 背景の絵の中の入口の位置。吹き出しの先端をここへ向ける。 */
export function entranceOf(
  key: string,
  entrance: string,
  wide: boolean
): readonly [number, number] {
  const place = places.get(tuning.places[key] ?? key)
  const anchor = (wide ? place?.entrances?.wide : place?.entrances?.narrow)?.[
    entrance
  ]
  if (!anchor) throw new Error(`入口の位置がない: ${key} ${entrance}`)
  return anchor
}
