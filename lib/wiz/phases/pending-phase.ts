import type { ConversationPhase } from "@/lib/wiz/phases/conversation-phase"
import { PhaseBase } from "@/lib/wiz/phases/phase-base"
import type { ExpeditionPhase } from "@/lib/wiz/phases/expedition-phase"
import type { TownPhase } from "@/lib/wiz/phases/town-phase"

/** 宝箱・罠・戦利品の板が出ている。道具を使っても結果は閉じない。 */
export class PendingPhase extends PhaseBase {
  readonly kind = "pending"

  use(good: string, member?: string) {
    return this.send<PendingPhase>({ type: "use", good, member }, ["pending"])
  }

  startConversation(trigger: "chest" | "item") {
    return this.send<ConversationPhase>(
      { type: "start-conversation", trigger },
      ["conversation"]
    )
  }

  discover(choice: string, skill?: string, member?: string) {
    return this.send<PendingPhase>(
      { type: "discover", choice, skill, member },
      ["pending"]
    )
  }

  acknowledge() {
    return this.send<ExpeditionPhase>({ type: "acknowledge" }, ["expedition"])
  }
  retreat() {
    return this.send<TownPhase>({ type: "retreat" }, ["town"])
  }
}
