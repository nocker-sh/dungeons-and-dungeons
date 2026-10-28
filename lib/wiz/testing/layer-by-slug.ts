import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealLayer = GameContent["layers"][number]

/** 層の定義。 */
export const layerBySlug = finder<RealLayer>("layer", content.layers)
