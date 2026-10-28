import type { WizWorldRuleResult } from "@/lib/wiz/core/world/world"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameReason } from "@/lib/wiz/state/game-reason"
import type { GameState } from "@/lib/wiz/state/state-schema"

/** 操作の結果。受け入れた次の状態と出来事、または拒否理由。 */
export type Transition = WizWorldRuleResult<GameState, GameEvent, GameReason>
