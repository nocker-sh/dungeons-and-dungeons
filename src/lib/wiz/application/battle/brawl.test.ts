import { describe, expect, it } from "vite-plus/test"
import {
  contentId,
  memberBySlug,
  createTestPlay,
  eventsOrThrow,
  startedState,
  turnActionFor,
} from "@/lib/wiz/testing"
import {
  GameCommandError,
  WizWorldEnvironment,
  type GameState,
} from "@/lib/wiz"

describe("殴る（使える手が尽きたとき）", () => {
  const alda = memberBySlug("alda").id

  /** アルダの攻撃できるワザをすべて使い切った状態で戦闘に入る。 */
  const dryBattle = () => {
    const { definition, game: probe } = createTestPlay()
    const base = startedState(definition)
    const view = probe.queries.commands(base, alda)!
    const empty = [...view.weaponSkills, ...view.skills]
      .filter((skill) => skill.kind === "hit" && skill.uses !== null)
      .map((skill) => ({ skill: skill.id, count: skill.uses! }))
    const state: GameState = {
      ...base,
      members: base.members.map((member) =>
        member.id === alda ? { ...member, used: empty } : member
      ),
    }
    const game = definition.create(
      WizWorldEnvironment.create({ random: () => 0.5, now: () => 0 }),
      state
    )
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    return { game, spent: empty.length }
  }

  it("[feature:W004] 攻撃できるワザが残っている間は「殴る」を選べない", () => {
    const { game } = createTestPlay()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    expect(game.queries.commands(game.state, alda)?.brawl).toBeNull()
    expect(
      (game.send({ type: "act", command: "brawl" }) as GameCommandError).code
    ).toBe("UNAVAILABLE")
  })

  it("[feature:W004] 尽きると「殴る」が出て、回数なしで使える", () => {
    const { game, spent } = dryBattle()
    expect(
      game.queries
        .commands(game.state, alda)
        ?.weaponSkills.every((skill) => skill.kind !== "hit" || !skill.usable)
    ).toBe(true)
    expect(game.queries.commands(game.state, alda)?.brawl?.name).toBe("殴る")
    // アルダの手番まで進める
    for (let guard = 0; guard < 10; guard++) {
      const view = game.queries.battle(game.state)!
      if (view.current.kind === "member" && view.current.id === alda) break
      eventsOrThrow(
        game.send(
          view.current.kind === "foe"
            ? { type: "foe-turn" }
            : turnActionFor(game, view.current.id)
        )
      )
    }
    const events = eventsOrThrow(game.send({ type: "act", command: "brawl" }))
    expect(events[0]).toMatchObject({
      type: "acted",
      command: "brawl",
      name: "殴る",
    })
    // 使用回数は減らない
    expect(
      game.state.members.find((member) => member.id === alda)?.used
    ).toHaveLength(spent)
  })
})
