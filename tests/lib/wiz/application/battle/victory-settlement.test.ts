import { expect, test } from "vite-plus/test"
import type { GameAction } from "@/lib/wiz/commands"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { turnActionFor } from "@/lib/wiz/testing/turn-action-for"

for (const restoreLoot of [false, true])
  test(`victory settles once across the last turn, loot confirmation and return: restore=${restoreLoot}`, () => {
    // 戦闘開始だけを局所条件にする。敵・装備・計算規則は正本を使い、そこまでの探索は対象外。
    const initial = aState()
      .inBattle({ foes: ["kamokutsu"] })
      .build()
    const game = createTestGame({ state: initial, random: 0 })
    let lastSave = game.save()
    let lastAction: GameAction = { type: "foe-turn" }
    let won = false
    for (
      let turn = 0;
      turn < 400 && game.state.phase.type === "battle";
      turn++
    ) {
      const actor = game.queries.battle(game.state)!.current
      lastAction =
        actor.kind === "foe"
          ? { type: "foe-turn" }
          : turnActionFor(game, actor.id)
      lastSave = JSON.parse(JSON.stringify(game.save()))
      const events = eventsOrThrow(game.send(lastAction))
      won ||= events.some((event) => event.type === "victory")
    }
    expect(won).toBe(true)
    expect(game.queries.route(game.state)?.pending?.kind).toBe("loot")
    const wonState = game.state
    expect(wonState.gold).toBeGreaterThan(initial.gold)
    expect(wonState.gear.length).toBeGreaterThan(initial.gear.length)

    // 決着直前の実際の保存からも、同じ環境入力なら同じ報酬になる。
    const lastTurn = createTestGame({ state: initial, random: 0 })
    expect(lastTurn.restore(lastSave)).toBeUndefined()
    eventsOrThrow(lastTurn.send(lastAction))
    expect(lastTurn.state).toEqual(wonState)

    const resumed = restoreLoot
      ? createTestGame({ state: initial, random: 0 })
      : game
    if (restoreLoot)
      expect(
        resumed.restore(JSON.parse(JSON.stringify(game.save())))
      ).toBeUndefined()
    expect(resumed.state).toEqual(wonState)
    expect(resumed.send(lastAction)).toMatchObject({ code: "WRONG_PHASE" })
    expect(resumed.state).toEqual(wonState)

    eventsOrThrow(resumed.send({ type: "acknowledge" }))
    const confirmed = resumed.state
    expect({ ...confirmed, phase: wonState.phase }).toEqual(wonState)
    expect(resumed.send({ type: "acknowledge" })).toBeInstanceOf(
      GameCommandError
    )
    expect(resumed.state).toBe(confirmed)

    eventsOrThrow(resumed.send({ type: "retreat" }))
    const returned = resumed.state
    expect(returned.phase.type).toBe("town")
    expect(returned.gold).toBe(wonState.gold)
    expect(returned.members).toEqual(wonState.members)
    expect(returned.gear).toEqual(wonState.gear)
    expect(returned.bag).toEqual(wonState.bag)
    expect(resumed.send({ type: "retreat" })).toMatchObject({
      code: "WRONG_PHASE",
    })
    expect(resumed.state).toBe(returned)
    expect(resumed.queries.problems(resumed.state)).toEqual([])
  })
