import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/** 討伐依頼を受ける。同じ依頼は一度だけ。 */
export class AcceptQuest {
  static readonly featureId = "W014"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}

  execute(state: GameState, input: GameActionOf<"accept-quest">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const definition = this.deps.catalog.quest(input.quest)
    if (!definition) return reject("UNKNOWN")
    if (definition.encounter) return reject("UNAVAILABLE")
    if (definition.requiresCleared && !state.cleared)
      return reject("UNAVAILABLE")
    if (state.quests.some((quest) => quest.id === input.quest))
      return reject("ALREADY")
    return accept(
      {
        ...state,
        quests: [
          ...state.quests,
          { id: input.quest, progress: 0, claimed: false },
        ],
      },
      { type: "quest-accepted", quest: input.quest }
    )
  }
}
