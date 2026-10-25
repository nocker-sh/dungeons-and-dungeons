import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { clampHp } from "@/lib/wiz/application/party/clamp-hp"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/**
 * 契約した悪魔から、戦闘で合体する悪魔を選ぶ。
 * 悪魔によって合体の効果（最大HPなど）が変わるので、主人公のHPを上限に収め直す。
 */
export class ChooseDemon {
  static readonly featureId = "W013"
  constructor(private readonly deps: Pick<GameDependencies, "party">) {}

  execute(state: GameState, input: GameActionOf<"choose-demon">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (!state.demons.some((demon) => demon.id === input.demon))
      return reject("NOT_OWNED")
    return accept(
      clampHp({ ...state, contract: input.demon }, this.deps.party),
      { type: "demon-chosen", demon: input.demon }
    )
  }
}
