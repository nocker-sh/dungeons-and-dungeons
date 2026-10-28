import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { GameState } from "@/lib/wiz/state/state-schema"

/** 最大HPが下がったとき、今のHPを上限に収める。 */
export function clampHp(state: GameState, party: PartyRules): GameState {
  return {
    ...state,
    members: state.members.map((member) => {
      const stats = party.stats(member, state)
      return { ...member, hp: Math.min(member.hp, stats.maxHp) }
    }),
  }
}
