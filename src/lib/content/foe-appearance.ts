import { FOE_ART } from "@/lib/content/looks"

/** 個体の識別子から同じ絵を引く。戦闘の乱数を消費せず、再開しても姿が変わらない。 */
export function foeAppearance(foe: string, appearanceId?: string) {
  const art = FOE_ART[foe]
  if (!art?.appearances?.length || !appearanceId) return art
  let hash = 0
  for (const character of appearanceId)
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  const appearances = [art, ...art.appearances]
  return { ...appearances[hash % appearances.length], glow: art.glow }
}

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
