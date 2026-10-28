import type { GameActionOf } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules/bag"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/** 達成した依頼を報告して報酬を受け取る。報告は一度だけ。 */
export class ClaimQuest {
  static readonly featureId = "W015"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}

  execute(state: GameState, input: GameActionOf<"claim-quest">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const def = this.deps.catalog.quest(input.quest)
    const quest = state.quests.find((entry) => entry.id === input.quest)
    if (!def || !quest) return reject("UNKNOWN")
    if (quest.claimed) return reject("ALREADY")
    if (quest.progress < def.count) return reject("NOT_READY")
    return accept(
      {
        ...state,
        gold: state.gold + def.reward.gold,
        bag: Bag.add(state.bag, def.reward.goods),
        quests: state.quests.map((entry) =>
          entry.id === quest.id ? { ...entry, claimed: true } : entry
        ),
      },
      { type: "quest-claimed", quest: def.id, gold: def.reward.gold }
    )
  }
}
