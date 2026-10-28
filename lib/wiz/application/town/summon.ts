import type { GameState } from "@/lib/wiz/state/state-schema"
import { reject } from "@/lib/wiz/application/reject"
import { inTown } from "@/lib/wiz/application/in-town"

/** 旧クライアントのガチャ操作を拒否する。保存の石・悪魔・経験値は保持する。 */
export class Summon {
  static readonly featureId = "W012"
  constructor(_deps?: unknown) {}
  execute(state: GameState, _input?: unknown, _environment?: unknown) {
    return reject(inTown(state) ? "INVALID_ACTION" : "WRONG_PHASE")
  }
}
