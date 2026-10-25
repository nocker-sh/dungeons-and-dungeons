import type { GameState } from "@/lib/wiz/state"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/** 開幕の野営を終えて街へ着く。名前と容姿はギルドの登録用紙で決めるので、登録待ちにする。 */
export class LeaveCamp {
  static readonly featureId = "W045"

  execute(state: GameState): Transition {
    if (state.phase.type !== "creating") return reject("WRONG_PHASE")
    if (state.conversation?.active) return reject("NOT_READY")
    return accept(
      {
        ...state,
        hero: { ...state.hero, registrationPending: true },
        phase: { type: "town" },
      },
      { type: "camp-left" }
    )
  }
}
