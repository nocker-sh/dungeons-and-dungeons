import { tuning } from "./data"
import { placeName, sceneOf } from "./places"

/** 役目（guide・guild・secret）から、その役の人の id。 */
export function personFor(role: string) {
  return tuning.people[role] ?? role
}

/** 店：場所の名前・擬音・店主。wide なら横長の画面用の背景。 */
export function shopLook(id: string, wide = false) {
  const shop = tuning.shops[id]
  const place = shop?.place ?? id
  return {
    kind: shop?.kind ?? "shop",
    place,
    name: placeName(place),
    scene: sceneOf(place, wide),
    keepers: shop?.keepers ?? [],
  }
}

/** 商店街に並ぶ店の id。 */
export function street(): readonly string[] {
  return tuning.street
}

/** 品物のアイコン名。looks.json の別名、なければ種類ごとの既定。 */
export function goodIconKey(id: string, kind?: string) {
  return (
    tuning.goodIcons[id] ?? (kind ? tuning.kindIcons[kind] : undefined) ?? id
  )
}
