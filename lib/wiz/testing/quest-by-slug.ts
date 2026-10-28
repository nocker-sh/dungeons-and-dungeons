import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealQuest = GameContent["quests"][number]

/** 討伐依頼の定義。 */
export const questBySlug = finder<RealQuest>("quest", content.quests)
