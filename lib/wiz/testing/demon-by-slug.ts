import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealDemon = GameContent["demons"][number]

/** 悪魔の定義。 */
export const demonBySlug = finder<RealDemon>("demon", content.demons)
