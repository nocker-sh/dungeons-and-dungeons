import type { Session } from "@/builder/lib/session"

/** 出撃中の全員と、育成対象の仲間を分ける。主人公の保存上のLvは成長の指標にしない。 */
export function partyLevels(session: Session) {
  const party = session.queries.party(session.state)
  const companions = party.filter((member) => !member.hero)
  const average = (members: typeof party) =>
    members.length
      ? members.reduce((sum, member) => sum + member.lv, 0) / members.length
      : 0
  return { all: average(party), companions: average(companions) }
}
