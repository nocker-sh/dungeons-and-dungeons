import { places, tuning, lines } from "./data"
import type { Stand, LayerSceneArt } from "./types"

/** 場所の背景。looks.json の places が資料の world の id を指す。 */
export function sceneOf(key: string, wide = false): string | null {
  const place = places.get(tuning.places[key] ?? key)
  return (wide ? (place?.wideImage ?? place?.image) : place?.image) ?? null
}

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

/** 店主・案内人の立ち位置と大きさ。背景の床・カウンターに合わせて場所のデータに持つ。 */
export function standOf(
  key: string,
  wide: boolean,
  index = 0
): Stand | undefined {
  const place = places.get(tuning.places[key] ?? key)
  return (wide ? place?.stands?.wide : place?.stands?.narrow)?.[index]
}

/** 場所の id（設定資料の背景）。入ったときの場面の条件に使う。 */
export function placeIdOf(key: string): string {
  return tuning.places[key] ?? key
}

/** 場所の slug（人が読む名前。/previews の URL などに使う）。 */
export function placeSlug(key: string): string {
  return places.get(tuning.places[key] ?? key)?.slug ?? key
}

export function placeName(key: string): string {
  return places.get(tuning.places[key] ?? key)?.name ?? key
}

/** 層の背景の候補（world.json の層の場所の scenes）。 */
export function layerScenes(layerId: string): readonly LayerSceneArt[] {
  const scene = tuning.layers[layerId]?.scene
  return (scene && places.get(scene)?.scenes) || []
}

/** エンジンが選んだ層の背景の絵。見つからなければ層の代表の絵。 */
export function layerSceneArt(
  layerId: string,
  key: string | null | undefined,
  wide = false
): string | undefined {
  const art = layerScenes(layerId).find((entry) => entry.key === key)
  if (!art) return layerLook(layerId).art
  return wide ? (art.wideImage ?? art.image) : art.image
}

/** 層の背景・光・案内人の説明。 */
export function layerLook(id: string): {
  art?: string
  glow?: string
  line: string
} {
  const look = tuning.layers[id] ?? {}
  return {
    art: (look.scene && places.get(look.scene)?.image) || undefined,
    glow: look.glow,
    line: lines.layers[id] ?? lines.guide.far,
  }
}
