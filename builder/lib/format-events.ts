import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { Session } from "@/builder/lib/session"

/** 出来事を一行ずつ。id は slug に直す。 */
export function formatEvents(session: Session, events: readonly GameEvent[]) {
  return events.map((event) =>
    JSON.stringify(event, (_key, value) =>
      typeof value === "string" ? session.slug(value) : value
    )
  )
}
