import type { Game } from "@/lib/wiz/game/game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

/** 敵の手番が来るまで、仲間は防御で進める。 */
export function advanceUntilFoeTurn(game: Game, limit = 10) {
  for (let guard = 0; guard < limit; guard++) {
    const view = game.queries.battle(game.state)!
    if (view.current.kind === "foe") return
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
  }
  throw new Error("敵の手番が来ない")
}
