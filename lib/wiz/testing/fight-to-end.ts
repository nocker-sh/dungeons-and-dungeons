import type { Game } from "@/lib/wiz/game/game"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { turnActionFor } from "@/lib/wiz/testing/turn-action-for"

/** 戦闘が終わるまで、仲間は攻撃（guard なら防御だけ）、敵は手番を進める。 */
export function fightToEnd(
  game: Game,
  command: "attack" | "guard" = "attack"
): GameEvent[] {
  const events: GameEvent[] = []
  for (
    let guard = 0;
    guard < 400 && game.state.phase.type === "battle";
    guard++
  ) {
    const view = game.queries.battle(game.state)!
    if (view.current.kind === "foe")
      events.push(...eventsOrThrow(game.send({ type: "foe-turn" })))
    else if (command === "guard")
      events.push(
        ...eventsOrThrow(game.send({ type: "act", command: "guard" }))
      )
    else
      events.push(
        ...eventsOrThrow(game.send(turnActionFor(game, view.current.id)))
      )
  }
  return events
}
