import type { GameState, Member } from "@/lib/wiz/state/state-schema"

/** 出撃している仲間だけを書き換える。控えはそのまま。 */
export function updateMembers(
  state: GameState,
  update: (member: Member) => Member
) {
  return state.members.map((member) =>
    state.party.includes(member.id) ? update(member) : member
  )
}
