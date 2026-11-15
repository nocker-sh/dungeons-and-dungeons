import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { createMember } from "@/lib/wiz/members/create-member"
import { starterGear } from "@/lib/wiz/members/starter-gear"
import type { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type { Random } from "@/lib/wiz/rules/random"
import type { GameState } from "@/lib/wiz/state/state-schema"

type Props = Readonly<{
  state: GameState
  catalog: GameCatalog
  weapons: WeaponRules
  nextId: () => string
  random?: Random
}>

/**
 * プレイヤーが仲間として戦っていた旧保存を、戦わない運営役の形へ移す。
 * プレイヤーを仲間・隊列・手番から外し、初期の仲間（マユ）を持っていなければ迎える。
 * 戦闘中は手番の並びを保ち、迎えた仲間は控えに置く（戦闘の途中からは加えない）。
 * 外した手番の続きは、読み込みの最後に本番の戦闘規則で進める（`resumeMigratedBattle`）。
 */
export function retireHeroFromParty(props: Props): GameState {
  const state = props.state
  const catalog = props.catalog
  const isHero = (id: string) => !!catalog.member(id)?.hero
  if (!state.members.some((member) => isHero(member.id))) return state
  const members = state.members.filter((member) => !isHero(member.id))
  const owned = new Set(members.map((member) => member.id))
  const joining = (catalog.data.startingCompanions ?? [])
    .filter((id) => !owned.has(id))
    .map((id) => catalog.member(id)!)
  const inBattle = state.phase.type === "battle"
  let party = state.party.filter((id) => !isHero(id))
  // プレイヤーが抜けた枠は、初期の仲間（迎えた者・控えにいた者）から、次にほかの控えから埋める
  if (!inBattle)
    for (const id of [
      ...(catalog.data.startingCompanions ?? []),
      ...members.map((member) => member.id),
    ])
      if (party.length < PARTY_SLOTS && !party.includes(id))
        party = [...party, id]
  const recruited = [
    ...state.recruited,
    ...catalog.data.recruits
      .filter(
        (entry) =>
          joining.some((def) => def.id === entry.member.id) &&
          !state.recruited.includes(entry.id)
      )
      .map((entry) => entry.id),
  ]
  const next: GameState = {
    ...state,
    members: [...members, ...joining.map(createMember)],
    party,
    recruited,
    chatted: state.chatted.filter((id) => !isHero(id)),
    gear: [
      ...state.gear.map((entry) =>
        entry.owner && isHero(entry.owner) ? { ...entry, owner: null } : entry
      ),
      ...joining.flatMap((def) =>
        starterGear(def, props.nextId, props.weapons, props.random)
      ),
    ],
  }
  if (next.phase.type !== "battle") return next
  const battle = next.phase.battle
  const gone = (ref: { kind: string; id: string }) =>
    ref.kind === "member" && isHero(ref.id)
  const order = battle.order.filter((ref) => !gone(ref))
  // 動く番だったプレイヤーの手番は、次の人の番にする
  const start = battle.turn % battle.order.length
  let turn = 0
  for (let step = 0; step < battle.order.length; step++) {
    const ref = battle.order[(start + step) % battle.order.length]
    if (gone(ref)) continue
    turn = order.indexOf(ref)
    break
  }
  return {
    ...next,
    phase: {
      ...next.phase,
      battle: {
        ...battle,
        order,
        turn,
        guarding: battle.guarding.filter((id) => !isHero(id)),
      },
    },
  }
}
