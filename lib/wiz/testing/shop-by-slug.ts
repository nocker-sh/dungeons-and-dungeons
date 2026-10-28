import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealShop = GameContent["shops"][number]

/** 店の定義。 */
export const shopBySlug = finder<RealShop>("shop", content.shops)
