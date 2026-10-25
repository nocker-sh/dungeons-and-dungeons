import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { GameState } from "@/lib/wiz/state"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { ConversationStartTransition } from "@/lib/wiz/application/conversation-start-transition"

export class StartConversation {
  static readonly featureId = "W031"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(
    state: GameState,
    input: GameActionOf<"start-conversation">,
    environment: WizWorldEnvironment
  ) {
    return new ConversationStartTransition(this.deps).execute(
      state,
      input,
      environment
    )
  }
}
