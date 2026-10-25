import type { GameAction } from "@/lib/wiz/commands"
import type { Game } from "@/lib/wiz/game"
import type { GameEvent } from "@/lib/wiz/state"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

/** 手番の仲間が送る指示。使える攻撃のワザ、尽きたら殴る、それも無ければ防御。 */
export function turnActionFor(game: Game, memberId: string): GameAction {
  const commands = game.queries.commands(game.state, memberId)!
  const hit = [
    ...commands.weaponSkills,
    ...commands.skills,
    ...(commands.blessing ? [commands.blessing] : []),
  ].find((skill) => skill.kind === "hit" && skill.usable)
  if (hit) return { type: "act", command: "skill", skill: hit.id }
  if (commands.brawl) return { type: "act", command: "brawl" }
  return { type: "act", command: "guard" }
}

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

/** 敵の手番が来るまで、仲間は防御で進める。 */
export function advanceUntilFoeTurn(game: Game, limit = 10) {
  for (let guard = 0; guard < limit; guard++) {
    const view = game.queries.battle(game.state)!
    if (view.current.kind === "foe") return
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
  }
  throw new Error("敵の手番が来ない")
}

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
