import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { contentId } from "@/lib/wiz/testing/content-id"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import type { GameEvent } from "@/lib/wiz/state/game-event"

const definition = new GameDefinition(catalogOf(realContent()))

describe("プレイヤーは戦わない運営役", () => {
  it("はじめからの隊列は仲間3人（タンク・回復・攻撃）で、プレイヤーは仲間に入らない", () => {
    const state = definition.initialState()
    expect(state.party).toEqual([
      contentId("alda"),
      contentId("mort"),
      contentId("mayu"),
    ])
    expect(
      state.members.some((member) => definition.catalog.member(member.id)?.hero)
    ).toBe(false)
  })
})

describe("[feature:W046] 戦闘で悪魔を呼ぶ", () => {
  const battle = (foes = ["kamokutsu", "kamokutsu"]) =>
    createTestGame({
      random: 0.5,
      state: aState()
        .inBattle({ foes, order: ["alda", "foe-1", "mort", "foe-2", "mayu"] })
        .build(),
    })

  it("敵全員へ悪魔のワザを放ち、手番は消えず、1戦闘に1回だけ", () => {
    const game = battle()
    const view = game.queries.battle(game.state)!
    expect(view.demonCall).toMatchObject({ usable: true, called: false })
    const before = game.state.phase.type === "battle" ? game.state.phase : null
    const hp = before!.battle.foes.map((foe) => foe.hp)
    const events = eventsOrThrow(game.send({ type: "call-demon" }))
    const acted = events[0] as Extract<GameEvent, { type: "acted" }>
    expect(acted).toMatchObject({
      command: "demon",
      demon: view.demonCall!.demon,
    })
    expect(acted.results).toHaveLength(2)
    if (game.state.phase.type !== "battle") throw new Error("battle ended")
    const after = game.state.phase.battle
    for (const [index, foe] of after.foes.entries())
      expect(foe.hp).toBeLessThan(hp[index])
    // 呼んだ仲間の手番は続く
    expect(after.turn).toBe(before!.battle.turn)
    expect(game.queries.battle(game.state)!.demonCall).toMatchObject({
      usable: false,
      called: true,
    })
    const again = game.send({ type: "call-demon" })
    expect((again as GameCommandError).code).toBe("ALREADY")
    // 続けて仲間の指示を選べる
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
  })

  it("敵の手番には呼べず、状態を変えない", () => {
    const game = createTestGame({
      state: aState()
        .inBattle({
          foes: ["kamokutsu"],
          order: ["foe-1", "alda", "mort", "mayu"],
        })
        .build(),
    })
    const before = game.save()
    const result = game.send({ type: "call-demon" })
    expect((result as GameCommandError).code).toBe("NOT_YOUR_TURN")
    expect(game.save()).toEqual(before)
  })
})
