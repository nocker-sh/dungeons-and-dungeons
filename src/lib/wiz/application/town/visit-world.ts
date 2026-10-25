import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { GameState } from "@/lib/wiz/state"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { WorldMapRules } from "@/lib/wiz/rules/world-map"
import { Bag } from "@/lib/wiz/rules/bag"
import { accept, reject } from "@/lib/wiz/application/transition"
import { ConversationStartTransition } from "@/lib/wiz/application/conversation-start-transition"

export class VisitWorld {
  static readonly featureId = "W043"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(state: GameState, _input: unknown, environment: WizWorldEnvironment) {
    const rules = new WorldMapRules(this.deps.catalog)
    const view = rules.view(state)
    if (!view?.ready) return reject("NOT_READY")
    const journey = rules.journey(state)
    const tile = view.current
    const collected = journey.collected.includes(tile.id)
    const next = collected
      ? state
      : {
          ...state,
          bag: Bag.add(state.bag, tile.goods ?? []),
          journey: { ...journey, collected: [...journey.collected, tile.id] },
        }
    if (tile.place) {
      const conversation = new ConversationStartTransition(this.deps).execute(
        next,
        { type: "start-conversation", trigger: "visit", place: tile.place },
        environment
      )
      if (conversation.accepted) return conversation
    }
    return collected ? reject("ALREADY") : accept(next)
  }
}
