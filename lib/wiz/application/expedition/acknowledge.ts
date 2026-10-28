import type { GameState } from "@/lib/wiz/state/state-schema"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/** 宝箱・罠・戦利品の板を閉じる。 */
export class Acknowledge {
  static readonly featureId = "W006"
  execute(state: GameState): Transition {
    if (state.phase.type !== "expedition") return reject("WRONG_PHASE")
    if (state.phase.expedition.pending?.kind === "discovery")
      return reject("PENDING")
    if (!state.phase.expedition.pending) return reject("NOT_READY")
    return accept(
      {
        ...state,
        phase: {
          type: "expedition",
          expedition: { ...state.phase.expedition, pending: null },
        },
      },
      { type: "acknowledged" }
    )
  }
}
