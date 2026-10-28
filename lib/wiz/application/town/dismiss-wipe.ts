import type { GameState } from "@/lib/wiz/state/state-schema"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/** 全滅の結果（失った金貨と持ち物）を見終えて閉じる。 */
export class DismissWipe {
  static readonly featureId = "W027"
  execute(state: GameState): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (!state.wipe) return reject("NOT_READY")
    return accept({ ...state, wipe: null }, { type: "wipe-dismissed" })
  }
}
