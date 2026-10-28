import type { GameReason } from "@/lib/wiz/state/game-reason"

/** 断られた操作。code で理由、cause に元の例外。 */
export class GameCommandError extends Error {
  constructor(
    readonly code: GameReason,
    cause?: unknown
  ) {
    super(code, { cause })
    this.name = "GameCommandError"
  }
}
