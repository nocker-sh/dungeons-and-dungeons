import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"
import { clampHp } from "@/lib/wiz/application/party/clamp-hp"

/** 装備を外して袋へ戻す。 */
export class Unequip {
  static readonly featureId = "W018"
  constructor(private readonly deps: Pick<GameDependencies, "party">) {}

  execute(state: GameState, input: GameActionOf<"unequip">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const gear = state.gear.find((entry) => entry.id === input.gear)
    if (!gear) return reject("NOT_OWNED")
    if (!gear.owner) return reject("ALREADY")
    // 専用の武器と、固定装備の仲間の防具は外せない
    if (this.deps.party.equipment.isFixedGear(gear)) return reject("FIXED_GEAR")
    const next: GameState = {
      ...state,
      gear: state.gear.map((entry) =>
        entry.id === gear.id ? { ...entry, owner: null } : entry
      ),
    }
    return accept(clampHp(next, this.deps.party), {
      type: "unequipped",
      gear: gear.id,
      member: gear.owner,
    })
  }
}
