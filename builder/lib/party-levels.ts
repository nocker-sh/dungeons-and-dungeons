import type { Session } from "@/builder/lib/session"

/**
 * 出撃中の仲間の平均レベル。プレイヤーは戦わず隊列に入らないので、全員と育成対象は同じ値になる。
 * 主人公が戦っていた頃の記録と比べられるように、両方の項目を残す。
 */
export function partyLevels(session: Session) {
  const party = session.queries.party(session.state)
  const average = party.length
    ? party.reduce((sum, member) => sum + member.lv, 0) / party.length
    : 0
  return { all: average, companions: average }
}
