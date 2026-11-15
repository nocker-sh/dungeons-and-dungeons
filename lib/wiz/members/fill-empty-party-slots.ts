import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameState } from "@/lib/wiz/state/state-schema"

/**
 * 隊列の空き枠を、控えの生きている仲間で埋める。満員の隊列は変えない。
 * 順番は旧保存の移行（`retireHeroFromParty`）と同じく、初期の仲間を先に、次にほかの控え。
 * 戦闘中に移行した旧保存は戦闘の途中で仲間を加えないため、戦闘の精算でここを通す。
 */
export function fillEmptyPartySlots(
  state: GameState,
  catalog: GameCatalog
): GameState {
  if (state.party.length >= PARTY_SLOTS) return state
  const living = new Set(
    state.members.filter((member) => member.hp > 0).map((member) => member.id)
  )
  let party = state.party
  for (const id of [
    ...(catalog.data.startingCompanions ?? []),
    ...state.members.map((member) => member.id),
  ])
    if (party.length < PARTY_SLOTS && !party.includes(id) && living.has(id))
      party = [...party, id]
  return party === state.party ? state : { ...state, party }
}
