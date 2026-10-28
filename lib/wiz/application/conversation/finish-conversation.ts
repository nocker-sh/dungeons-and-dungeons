import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"

export class FinishConversation {
  static readonly featureId = "W032"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(state: GameState, input: GameActionOf<"finish-conversation">) {
    const current = state.conversation
    if (!current?.active) return reject("NOT_READY")
    const active = this.deps.catalog.data.conversations?.find(
      (entry) => entry.id === current.active
    )
    if (!active) return reject("NOT_READY")
    // 未選択のまま既読にすると、一度きりの会話の返答とフラグを失ってしまう。
    if (active.choice && input.choice === undefined)
      return reject("INVALID_ACTION")
    if (input.choice !== undefined && !active.choice?.options[input.choice])
      return reject("INVALID_ACTION")
    const rules = new ConversationRules(this.deps.catalog)
    const flags = rules.flagsAfter(state, active, input.choice)
    const seen = current.seen.includes(current.active)
      ? current.seen
      : [...current.seen, current.active]
    return accept({
      ...state,
      conversation: {
        ...current,
        active: null,
        last: current.active,
        seen,
        ...(flags.length ? { flags } : {}),
      },
    })
  }
}
