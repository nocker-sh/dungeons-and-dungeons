import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import { drawWeighted } from "@/lib/wiz/rules"
import type { GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/** お金を払って募集の枠を引き直す。珍しい冒険者ほど出にくい。契約済みの者も並ぶことがある。 */
export class Reroll {
  static readonly featureId = "W022"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}

  execute(
    state: GameState,
    _input: GameActionOf<"reroll">,
    environment: WizWorldEnvironment
  ): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const { recruits, recruiting } = this.deps.catalog.data
    const active = recruits.filter((entry) => !entry.retired)
    if (!active.length) return reject("UNAVAILABLE")
    if (state.gold < recruiting.reroll) return reject("NO_GOLD")
    const board = drawWeighted(
      environment.random,
      active,
      recruiting.slots,
      (entry) => entry.weight ?? 1
    ).map((entry) => entry.id)
    return accept(
      { ...state, gold: state.gold - recruiting.reroll, board },
      { type: "rerolled", board }
    )
  }
}
