import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealFoe = GameContent["foes"][number]

/** 敵の定義。 */
export const foeBySlug = finder<RealFoe>("foe", content.foes)
