import { SupplyRules } from "@/lib/wiz/rules/supply-rules"
import type { GameActionOf } from "@/lib/wiz/commands"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { Expedition, GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { MemberBonds } from "@/lib/wiz/rules/member-bonds"
import { partyMembers } from "@/lib/wiz/application/party-members"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/** 街はずれで行き先の層を選び、最初の地点へ降りる。 */
export class Depart {
  static readonly featureId = "W001"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "expedition">
  ) {}

  execute(state: GameState, input: GameActionOf<"depart">): Transition {
    if (state.phase.type !== "town") return reject("WRONG_PHASE")
    // 最初はギルドの受付で名前を登録してから。登録前はダンジョンへ行かない
    if (state.hero.registrationPending) return reject("UNREGISTERED")
    const layer = this.deps.catalog.layer(input.layer)
    if (!layer) return reject("UNKNOWN")
    if (this.deps.catalog.layerIndex(layer.id) > state.reached)
      return reject("LOCKED")
    const party = partyMembers(state)
    // 出撃は3人編成。そろうまでは酒場の募集で仲間を集める
    if (party.length < PARTY_SLOTS) return reject("SHORT")
    if (party.some((member) => member.hp <= 0)) return reject("DOWN")
    if (party.some((member) => this.deps.expedition.exhausted(member.fatigue)))
      return reject("TIRED")
    const expedition: Expedition = {
      layer: layer.id,
      at: layer.start,
      visited: [layer.start],
      events: [],
      pending: null,
      loot: { gold: 0, goods: [] },
      cleared: false,
    }
    return accept(
      {
        ...state,
        // 一緒に潜るたびに、出撃の仲間と少し打ち解ける
        members: MemberBonds.raise(state, this.deps.catalog),
        lastLayer: layer.id,
        provisions: SupplyRules.packed(state, this.deps.catalog),
        phase: { type: "expedition", expedition },
      },
      { type: "departed", layer: layer.id }
    )
  }
}
