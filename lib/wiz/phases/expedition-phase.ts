import type { ConversationPhase } from "@/lib/wiz/phases/conversation-phase"
import { PhaseBase } from "@/lib/wiz/phases/phase-base"
import type { AfterAdvance } from "@/lib/wiz/phases/phase"
import type { TownPhase } from "@/lib/wiz/phases/town-phase"

/** 探索中（板が出ていない）：進む・撤退・道具。 */
export class ExpeditionPhase extends PhaseBase {
  readonly kind = "expedition"

  survey(to: string) {
    return this.send<ExpeditionPhase>({ type: "survey", to }, ["expedition"])
  }

  startConversation(trigger: "branch") {
    return this.send<ConversationPhase>(
      { type: "start-conversation", trigger },
      ["conversation"]
    )
  }

  advance(to: string) {
    return this.send<AfterAdvance>({ type: "advance", to }, [
      "expedition",
      "pending",
      "member-turn",
      "foe-turn",
    ])
  }
  retreat() {
    return this.send<TownPhase>({ type: "retreat" }, ["town"])
  }
  use(good: string, member?: string) {
    return this.send<ExpeditionPhase>({ type: "use", good, member }, [
      "expedition",
    ])
  }
}
