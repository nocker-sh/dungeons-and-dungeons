import { PARTY_SLOTS } from "@/lib/wiz"
import type { Session } from "../session"

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

/**
 * 遊び始めの準備：3人そろえ、開始時から契約したロクスと合体する。
 * ガチャや階級による相棒の自動入替はしない。
 */
export function startParty(session: Session) {
  const spent = fillParty(session)
  // 潜る前に召喚石を使い切る（街の一日と同じ）。一回目は必ず成功する
  // 最初のロクス契約を維持する。抽選・階級による自動切替はない。
  chooseFirstPartner(session)
  return spent
}

/** 未合体の場合だけ、既に契約した相棒を選ぶ。 */
export function chooseFirstPartner(session: Session) {
  if (!session.state.contract && session.state.demons[0])
    session.send({ type: "choose-demon", demon: session.state.demons[0].id })
}

/** 仲間ひとりの強さの目安。募集の枠と出撃中の仲間を同じ尺度で比べる。 */
function strength(member: {
  maxHp: number
  str: number
  tec: number
  spd: number
  lv: number
}) {
  return (
    member.maxHp * 0.15 +
    member.str +
    member.tec +
    member.spd * 0.5 +
    member.lv * 2
  )
}

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
