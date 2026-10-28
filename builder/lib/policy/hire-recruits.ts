import type { Session } from "@/builder/lib/session"
import { strength } from "@/builder/lib/policy/strength"

/**
 * 求人：出撃中のいちばん弱い仲間より強い枠があれば契約して入れ替える。
 * 良い枠がなければ引き直す。0層は最初の3人で測るので何もしない。払った額を返す。
 */
export function hireRecruits(session: Session, reserve: number) {
  const { queries, catalog } = session
  if (session.state.reached < 1) return 0
  let spent = 0
  let rerolls = 0
  for (let guard = 0; guard < 8; guard++) {
    const others = queries
      .party(session.state)
      .filter((member) => !member.hero)
      .sort((a, b) => strength(a) - strength(b))
    const weakest = others[0]
    if (!weakest) break
    const best = queries
      .recruits(session.state)
      .filter((entry) => !entry.hired)
      .flatMap((entry) => {
        const def = catalog.recruit(entry.id)
        if (!def) return []
        return [
          {
            id: entry.id,
            member: def.member.id,
            price: entry.price,
            score: strength({ ...def.member.stats, lv: def.member.lv }),
          },
        ]
      })
      .sort((a, b) => b.score - a.score)[0]
    if (!best || best.score <= strength(weakest)) {
      const reroll = queries.reroll(session.state)
      if (rerolls >= 2) break
      if (session.state.gold - reroll.price < reserve * 4) break
      if (!Array.isArray(session.send({ type: "reroll" }))) break
      spent += reroll.price
      rerolls++
      continue
    }
    if (session.state.gold - best.price < reserve) break
    const before = session.state.gold
    if (!Array.isArray(session.send({ type: "recruit", recruit: best.id })))
      break
    spent += before - session.state.gold
    session.send({ type: "swap", out: weakest.id, in: best.member })
  }
  return spent
}
