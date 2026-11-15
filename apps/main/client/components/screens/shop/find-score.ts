import type { AppraisalFind } from "@/client/components/game/appraisal-card-shared"

/** 鑑定の品の良さ：持つと強くなる・掘り出し物・レア度の順に重い。 */
export function findScore(find: AppraisalFind) {
  const rarity = find.rarity === "SR" ? 2 : find.rarity === "R" ? 1 : 0
  const gain = find.upgrade ? find.upgrade.after - find.upgrade.before : 0
  return gain * 100 + (find.bargain ? 50 : 0) + rarity * 10
}
