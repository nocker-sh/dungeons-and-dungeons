import { foeAppearance } from "@/content/foe-appearance"

/** ワザIDで本人の攻撃を引く。数値の巡回は旧プレビューとの互換用だけ。 */
export function foeAttackImage(
  art: ReturnType<typeof foeAppearance>,
  action: number | { skill?: string }
) {
  if (typeof action !== "number")
    return (
      (action.skill ? art?.skills?.[action.skill] : undefined) ??
      art?.attack ??
      art?.attacks?.[0] ??
      art?.img
    )
  if (art?.attacks?.length)
    return art.attacks[Math.max(0, Math.floor(action)) % art.attacks.length]
  return art?.attack ?? art?.img
}
