import type { Session } from "../session"

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

/**
 * 買っておく回復の道具。パーティのHPが増えたら、それに見合う強さの薬へ切り替える。
 * 目安は「平均の最大HPの4分の1以上を戻せる、いちばん安い薬」。
 */
export function healItemFor(session: Session) {
  const heals = session.catalog.data.goods.filter(
    (good) =>
      good.kind === "item" &&
      good.effect?.type === "heal" &&
      !good.effect.all &&
      good.price
  )
  if (!heals.length) return undefined
  const party = session.queries.party(session.state)
  const want =
    party.reduce((sum, member) => sum + member.maxHp, 0) /
    Math.max(1, party.length) /
    4
  const hp = (good: (typeof heals)[number]) =>
    good.effect?.type === "heal" ? good.effect.hp : 0
  const enough = heals
    .filter((good) => hp(good) >= want)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  return enough[0] ?? [...heals].sort((a, b) => hp(b) - hp(a))[0]
}
