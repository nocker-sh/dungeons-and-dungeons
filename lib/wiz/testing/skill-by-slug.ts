import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealSkill = GameContent["skills"][number]

/** ワザの定義。 */
export const skillBySlug = finder<RealSkill>("skill", content.skills)
