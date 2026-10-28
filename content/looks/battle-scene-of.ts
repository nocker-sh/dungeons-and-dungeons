import { places, tuning } from "@/content/looks/data"

/**
 * 戦闘の背景。place はエンジンの戦闘の Query が返す戦う場所の鍵（依頼の場所、または層の id）。
 * 場所に戦闘用の絵がなければ、その場所の通常の背景を使う。
 */
export function battleSceneOf(place: string, wide = false): string | null {
  const entry = places.get(
    tuning.layers[place]?.scene ?? tuning.places[place] ?? place
  )
  const battle = wide
    ? (entry?.battleWideImage ?? entry?.battleImage)
    : entry?.battleImage
  const plain = wide ? (entry?.wideImage ?? entry?.image) : entry?.image
  return battle ?? plain ?? null
}
