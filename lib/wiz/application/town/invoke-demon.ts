import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { DemonInvocationRules } from "@/lib/wiz/rules/demon-invocation-rules"
import { reject } from "@/lib/wiz/application/reject"
import { ConversationStartTransition } from "@/lib/wiz/application/conversation-start-transition"

/** 契約書は最初の呼び出しだけ消費する。会話を開始できないときは一切払わない。 */
export class InvokeDemon {
  static readonly featureId = "W044"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(
    state: GameState,
    input: GameActionOf<"invoke-demon">,
    environment: WizWorldEnvironment
  ) {
    const invocation = new DemonInvocationRules(this.deps.catalog).prepare(
      state,
      input.demon
    )
    if (!invocation.prepared) return reject(invocation.reason)
    return new ConversationStartTransition(this.deps).execute(
      invocation.state,
      { type: "start-conversation", trigger: "talk", resident: input.demon },
      environment
    )
  }
}
