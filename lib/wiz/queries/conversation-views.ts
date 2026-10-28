import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import type {
  ConversationSubject,
  ConversationTrigger,
} from "@/lib/wiz/conversations/schema"
import type { GameState } from "@/lib/wiz/state/state-schema"

/** 会話の候補・操作可否と、未読の案内。 */
export class ConversationViews {
  readonly #rules: ConversationRules

  constructor(private readonly catalog: GameCatalog) {
    this.#rules = new ConversationRules(catalog)
  }

  inspect(
    state: GameState,
    trigger: ConversationTrigger,
    subject: ConversationSubject = {}
  ) {
    return this.#rules.inspect(state, trigger, subject)
  }

  canStart(
    state: GameState,
    trigger: ConversationTrigger,
    subject: ConversationSubject = {}
  ) {
    return this.#rules.canOffer(state, trigger, subject)
  }

  visitSceneAwaiting(state: GameState, place: string) {
    return this.#rules.awaiting(state, "visit", { place })
  }

  residentHasNews(state: GameState, resident: string) {
    return this.#rules
      .available(state, "talk", { resident })
      .some((entry) => !state.conversation?.seen.includes(entry.id))
  }

  active(state: GameState) {
    return (
      this.catalog.data.conversations?.find(
        (entry) => entry.id === state.conversation?.active
      ) ?? null
    )
  }
}
