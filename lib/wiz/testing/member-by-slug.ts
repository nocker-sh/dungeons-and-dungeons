import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealMember = GameContent["party"][number]

export const members: readonly RealMember[] = [
  ...content.party,
  ...content.recruits.map((entry) => entry.member),
]

/** 仲間の定義（主人公と募集の冒険者）。 */
export const memberBySlug = finder<RealMember>("member", members)
