import type { GameEvent } from "@/lib/wiz/state/game-event"

export function arrived(events: readonly GameEvent[]) {
  return events.find(
    (event): event is Extract<GameEvent, { type: "arrived" }> =>
      event.type === "arrived"
  )
}
