import { PhaseBase } from "@/lib/wiz/phases/phase-base"
import type { TownPhase } from "@/lib/wiz/phases/town-phase"
import type { ExpeditionPhase } from "@/lib/wiz/phases/expedition-phase"
import type { PendingPhase } from "@/lib/wiz/phases/pending-phase"
import type { CreatingPhase } from "@/lib/wiz/phases/creating-phase"

/** 会話中は会話を終える操作だけを公開する。 */
export class ConversationPhase extends PhaseBase {
  readonly kind = "conversation"
  /** choice は選んだ答えの番号。選択肢がなければ省く。 */
  finish(choice?: number) {
    return this.send<
      TownPhase | ExpeditionPhase | PendingPhase | CreatingPhase
    >(
      choice === undefined
        ? { type: "finish-conversation" }
        : { type: "finish-conversation", choice },
      ["town", "expedition", "pending", "creating"]
    )
  }
}
