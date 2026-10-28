import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { Phase, Step } from "@/lib/wiz/phases/phase"

/** 画面向け：一手の結果を出来事の配列にする。フェーズが違えば WRONG_PHASE。 */
export function eventsOf(
  step: Step<Phase> | null | undefined
): readonly GameEvent[] | GameCommandError {
  if (!step) return new GameCommandError("WRONG_PHASE")
  return step instanceof GameCommandError ? step : step.events
}
