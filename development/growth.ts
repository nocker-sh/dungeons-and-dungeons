import { contentSource } from "@/content/game-content"
import { growthMemberOf } from "@/development/growth-member-of"

/** 主人公（プレイヤー）の成長。 */
export const heroGrowthMember = growthMemberOf(
  contentSource.party.find((entry) => "hero" in entry && entry.hero)?.id
)
