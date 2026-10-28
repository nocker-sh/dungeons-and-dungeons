import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/** 前衛と後衛を一人ずつ入れ替える。並びの左2人が前衛、右が後衛なので、二人の位置を入れ替える。 */
export class SwapRows {
  static readonly featureId = "W020"
  constructor(private readonly deps: Pick<GameDependencies, "party">) {}

  execute(state: GameState, input: GameActionOf<"swap-rows">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const a = state.party.indexOf(input.a)
    const b = state.party.indexOf(input.b)
    if (a < 0 || b < 0) return reject("UNKNOWN")
    const rowA = this.deps.party.rowOf(state, input.a)
    const rowB = this.deps.party.rowOf(state, input.b)
    if (rowA === rowB) return reject("UNAVAILABLE")
    const front = rowA === "front" ? input.a : input.b
    const back = rowA === "front" ? input.b : input.a
    const party = [...state.party]
    party[a] = input.b
    party[b] = input.a
    return accept(
      { ...state, party },
      { type: "rows-swapped", front: back, back: front }
    )
  }
}
