import type { WizWorldRuleResult } from "@/lib/wiz/core/world/world"
import type { GameEvent, GameReason, GameState } from "@/lib/wiz/state"

/** 操作の結果。受け入れた次の状態と出来事、または拒否理由。 */
export type Transition = WizWorldRuleResult<GameState, GameEvent, GameReason>

export function accept(state: GameState, ...events: GameEvent[]): Transition {
  return { accepted: true, state, events }
}

export function reject(reason: GameReason): Transition {
  return { accepted: false, reason }
}
