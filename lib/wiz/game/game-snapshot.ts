import type { GameReason } from "@/lib/wiz/state/game-reason"
import type { GameState } from "@/lib/wiz/state/state-schema"

/** 購読者へ渡す一枚の写し。error は直前の操作が断られた理由。 */
export type GameSnapshot = Readonly<{
  state: GameState
  error: GameReason | null
}>
