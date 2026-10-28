import type { GameState } from "@/lib/wiz/state/state-schema"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/** ダンジョンを踏破した場面（エンディング）を見終える。以降は踏破後として遊べる。 */
export class SeeEnding {
  static readonly featureId = "W028"
  execute(state: GameState): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (!state.cleared || state.endingSeen) return reject("NOT_READY")
    return accept({ ...state, endingSeen: true }, { type: "ending-seen" })
  }
}
