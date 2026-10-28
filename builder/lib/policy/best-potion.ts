import type { Session } from "@/builder/lib/session"

/**
 * 使う回復の薬を選ぶ。減った分を埋められる、いちばん弱い薬。
 * 埋められる薬がなければ、いちばん強い薬を使う。
 */
export function bestPotion<T extends { id: string }>(
  session: Session,
  items: readonly T[],
  missing: number
) {
  const hp = (item: T) => {
    const effect = session.catalog.good(item.id)?.effect
    return effect?.type === "heal" ? effect.hp : 0
  }
  const sorted = [...items].sort((a, b) => hp(a) - hp(b))
  return sorted.find((item) => hp(item) >= missing) ?? sorted[sorted.length - 1]
}
