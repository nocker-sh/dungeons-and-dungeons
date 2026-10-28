import { contentSource } from "@/content/game-content"

/** 成長を見られる仲間（ゲームの数値を持つ者）。 */
export type GrowthMember = {
  id: string
  startLevel: number
  grows: boolean
  /** 仲間ごとの伸びがなく、共通の伸びを使っているか。 */
  sharedGrowth: boolean
}

export const growthMembers: GrowthMember[] = [
  ...contentSource.party,
  ...contentSource.recruits.map((recruit) => recruit.member),
].map((entry) => ({
  id: entry.id,
  startLevel: entry.lv,
  grows: !("hero" in entry && entry.hero),
  sharedGrowth: !("growth" in entry && entry.growth),
}))

/** 設定資料のIDから、成長を見られる仲間を引く。ゲームの数値がなければ undefined。 */
export function growthMemberOf(id: string | undefined) {
  return growthMembers.find((member) => member.id === id)
}
