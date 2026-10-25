import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { GameState } from "@/lib/wiz/state"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { accept, reject } from "@/lib/wiz/application/transition"

export class ConversationStartTransition {
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(
    state: GameState,
    input: GameActionOf<"start-conversation">,
    environment: WizWorldEnvironment
  ) {
    const rules = new ConversationRules(this.deps.catalog)
    const subject = { resident: input.resident, place: input.place }
    if (!rules.canStart(state, input.trigger, subject))
      return reject("NOT_READY")
    const selected = rules.select(
      state,
      input.trigger,
      environment.random,
      subject
    )
    if (!selected) return reject("NOT_READY")
    return accept({
      ...state,
      conversation: {
        ...state.conversation,
        seen: state.conversation?.seen ?? [],
        last: state.conversation?.last ?? null,
        active: selected.id,
        ...(input.trigger === "visit" && input.place
          ? {
              visits: {
                ...state.conversation?.visits,
                [input.place]: state.nights,
              },
            }
          : {}),
      },
    })
  }
}
