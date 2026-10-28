import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { Transition } from "@/lib/wiz/application/transition"

export function accept(state: GameState, ...events: GameEvent[]): Transition {
  return { accepted: true, state, events }
}
