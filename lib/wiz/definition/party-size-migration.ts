import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameState } from "@/lib/wiz/state/state-schema"

/**
 * 4人で出撃していた古い保存を3人へ移す。主人公を残し、並びの右から控えへ回す（雇った仲間はそのまま）。
 * 戦闘中なら控えへ回った仲間を手番から除き、いま動く番の人を保つ。
 */
export function fitPartySize(
  state: GameState,
  catalog: GameCatalog
): GameState {
  if (state.party.length <= PARTY_SLOTS) return state
  const heroes = state.party.filter((id) => catalog.member(id)?.hero).length
  let room = PARTY_SLOTS - heroes
  const party = state.party.filter((id) => {
    if (catalog.member(id)?.hero) return true
    if (room <= 0) return false
    room--
    return true
  })
  const benchedIds = new Set(state.party.filter((id) => !party.includes(id)))
  const hasBenchedBlessing = state.members.some(
    (member) => benchedIds.has(member.id) && member.blessing !== undefined
  )
  const members = hasBenchedBlessing
    ? state.members.map((member) => {
        if (!benchedIds.has(member.id) || member.blessing === undefined)
          return member
        const { blessing: _blessing, ...rest } = member
        return rest
      })
    : state.members
  if (state.phase.type !== "battle") return { ...state, party, members }
  const battle = state.phase.battle
  const benched = (ref: { kind: string; id: string }) =>
    ref.kind === "member" && !party.includes(ref.id)
  const order = battle.order.filter((ref) => !benched(ref))
  // 動く番の人が控えへ回ったら、その次の人の番にする
  const start = battle.turn % battle.order.length
  let turn = 0
  for (let step = 0; step < battle.order.length; step++) {
    const ref = battle.order[(start + step) % battle.order.length]
    if (benched(ref)) continue
    turn = order.indexOf(ref)
    break
  }
  return {
    ...state,
    party,
    members,
    phase: {
      ...state.phase,
      battle: {
        ...battle,
        order,
        turn,
        guarding: battle.guarding.filter(
          (id) => party.includes(id) || !state.party.includes(id)
        ),
      },
    },
  }
}
