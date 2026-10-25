import type { GameState, Member } from "@/lib/wiz/state"

/** 出撃している3人。並び順のまま返す。 */
export function partyMembers(state: GameState): Member[] {
  return state.party.flatMap((id) =>
    state.members.filter((member) => member.id === id)
  )
}
