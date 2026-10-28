import type { Session } from "@/builder/lib/session"

/**
 * 前衛が後衛の半分未満の耐久しか持たないとき、その仲間を後ろへ回す。
 * 僅差では現在の配置を保ち、回復役や近接武器の配置を毎日入れ替えない。
 * HPと防具の最大耐久を使い、一時的な負傷や損耗では配置を変えない。
 */
export function protectFragileFront(session: Session) {
  if (session.state.phase.type !== "town") return
  const party = session.queries.party(session.state)
  const back = party.find((member) => member.row === "back")
  if (!back) return
  const endurance = (member: (typeof party)[number]) =>
    member.maxHp + (member.armor?.maxDurability ?? 0)
  const fragile = party
    .filter((member) => member.row === "front")
    .sort((left, right) => endurance(left) - endurance(right))[0]
  if (fragile && endurance(fragile) < endurance(back) / 2)
    session.must({ type: "swap-rows", a: fragile.id, b: back.id })
}
