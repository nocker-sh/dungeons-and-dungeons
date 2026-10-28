import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealGood = GameContent["goods"][number]

/** 品物の定義（値段・攻撃力などの数値はここから読む）。 */
export const goodBySlug = finder<RealGood>("good", content.goods)
