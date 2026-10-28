import { tuning } from "@/content/looks/data"
import { placeName } from "@/content/looks/place-name"
import { sceneOf } from "@/content/looks/scene-of"

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
