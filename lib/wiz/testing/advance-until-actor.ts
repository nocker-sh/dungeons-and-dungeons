import type { Game } from "@/lib/wiz/game/game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { turnActionFor } from "@/lib/wiz/testing/turn-action-for"

/**
 * その仲間の手番が来るまで進める。
 * command が guard なら仲間は防御だけ、attack なら使えるワザで攻撃する。
 */
export function advanceUntilActor(
  game: Game,
  actorId: string,
  command: "attack" | "guard" = "guard",
  limit = 10
) {
  for (let guard = 0; guard < limit; guard++) {
    const view = game.queries.battle(game.state)!
    if (view.current.kind === "member" && view.current.id === actorId) return
    eventsOrThrow(
      game.send(
        view.current.kind === "foe"
          ? { type: "foe-turn" }
          : command === "guard"
            ? { type: "act", command: "guard" }
            : turnActionFor(game, view.current.id)
      )
    )
  }
}
