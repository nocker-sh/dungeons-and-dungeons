import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealRecruit = GameContent["recruits"][number]

/** 募集の定義（値段と冒険者）。 */
export const recruitBySlug = finder<RealRecruit>("recruit", content.recruits)
