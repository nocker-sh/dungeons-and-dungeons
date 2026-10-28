import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { Session } from "@/builder/lib/session"

/**
 * 出撃の3人をそろえる。募集の枠から、払える安い順に契約する。
 * 始めたては主人公ひとりなので、最初の街でここが3人を雇う。払った額を返す。
 */
export function fillParty(session: Session, reserve = 0) {
  const { queries } = session
  let spent = 0
  for (let guard = 0; guard < 12; guard++) {
    if (session.state.party.length >= PARTY_SLOTS) break
    const next = queries
      .recruits(session.state)
      .filter(
        (entry) => !entry.hired && entry.price <= session.state.gold - reserve
      )
      .sort((a, b) => a.price - b.price)[0]
    if (!next) {
      // 払える枠がなければ引き直して探す（枠は引き直すまで残る）
      const reroll = queries.reroll(session.state)
      if (session.state.gold - reroll.price < reserve) break
      if (!Array.isArray(session.send({ type: "reroll" }))) break
      spent += reroll.price
      continue
    }
    const before = session.state.gold
    if (!Array.isArray(session.send({ type: "recruit", recruit: next.id })))
      break
    spent += before - session.state.gold
  }
  return spent
}
