import { layerScenes } from "@/content/looks/layer-scenes"
import { layerLook } from "@/content/looks/layer-look"

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
