import { places, tuning } from "@/content/looks/data"
import type { LayerSceneArt } from "@/content/looks/types"

/** 層の背景の候補（world.json の層の場所の scenes）。 */
export function layerScenes(layerId: string): readonly LayerSceneArt[] {
  const scene = tuning.layers[layerId]?.scene
  return (scene && places.get(scene)?.scenes) || []
}
