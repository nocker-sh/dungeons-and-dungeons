import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

describe("探索なしの街・農場の戦闘", () => {
  it("[feature:W039] 1操作で戦闘に入り、出撃・移動・疲れ・層進行を変えない", () => {
    const game = createTestGame()
    const before = game.state
    const quest = game.queries
      .quests(before)
      .find((entry) => entry.encounter?.place === "farm")!
    const events = eventsOrThrow(
      game.send({ type: "fight-quest", quest: quest.id })
    )
    expect(events.map((event) => event.type)).toEqual(["encounter"])
    expect(game.state.phase.type).toBe("battle")
    expect(game.queries.expedition(game.state)).toBeNull()
    expect(game.queries.route(game.state)).toBeNull()
    expect(game.state.members).toEqual(before.members)
    expect(game.state.lastLayer).toEqual(before.lastLayer)
    expect(game.state.reached).toBe(before.reached)
  })

  it("すべての単発依頼で勝利から自動報酬、二重受取禁止、ダンジョン進行を保持", () => {
    const { definition, game: original } = createTestPlay()
    for (const quest of definition.catalog.data.quests.filter(
      (entry) => entry.encounter
    )) {
      const initial = {
        ...original.state,
        reached: 2,
        members: original.state.members.map((member) => ({
          ...member,
          hp: 5000,
          stats: { ...member.stats, maxHp: 5000, str: 1000, tec: 1000 },
        })),
      }
      const game = definition.create(testEnvironment(), initial)
      eventsOrThrow(game.send({ type: "fight-quest", quest: quest.id }))
      const events = fightToEnd(game)
      const victory = events.find((event) => event.type === "victory")!
      expect(victory.type).toBe("victory")
      if (victory.type !== "victory") throw new Error("勝利していない")
      expect(game.state.phase.type).toBe("town")
      expect(game.state.gold).toBe(initial.gold + victory.gold)
      expect(victory.gold).toBeGreaterThanOrEqual(quest.reward.gold)
      expect(game.state.quests.find((entry) => entry.id === quest.id)).toEqual({
        id: quest.id,
        progress: quest.count,
        claimed: true,
      })
      expect([
        game.state.reached,
        game.state.cleared,
        game.state.lastLayer,
      ]).toEqual([initial.reached, initial.cleared, initial.lastLayer])
      const save = game.save()
      expect(
        game.send({ type: "fight-quest", quest: quest.id })
      ).toBeInstanceOf(GameCommandError)
      expect(
        game.send({ type: "claim-quest", quest: quest.id })
      ).toBeInstanceOf(GameCommandError)
      expect(game.save()).toEqual(save)
    }
  })

  it("敗北しても所持金・品物を失わず、回復後に同じ依頼を再挑戦できる", () => {
    const { definition, game: original } = createTestPlay()
    const initial = {
      ...original.state,
      members: original.state.members.map((member) => ({ ...member, hp: 1 })),
      gear: original.state.gear.map((gear) => ({
        ...gear,
        wear: definition.catalog.good(gear.good)?.durability ?? 0,
      })),
    }
    const game = definition.create(testEnvironment(), initial)
    const quest = contentId("q-town-crates")
    eventsOrThrow(game.send({ type: "fight-quest", quest }))
    expect(
      fightToEnd(game, "guard").some((event) => event.type === "defeated")
    ).toBe(true)
    expect(game.state.phase.type).toBe("town")
    expect(game.state.gold).toBe(initial.gold)
    expect(game.state.bag).toEqual(initial.bag)
    expect(game.state.wipe).toBeNull()
    expect(game.state.quests.find((entry) => entry.id === quest)?.claimed).toBe(
      false
    )
    eventsOrThrow(game.send({ type: "fight-quest", quest }))
    expect(game.state.phase.type).toBe("battle")
  })

  it("戦闘中の保存から復帰でき、偽の戦闘依頼は拒否する", () => {
    const { definition, game } = createTestPlay()
    eventsOrThrow(
      game.send({ type: "fight-quest", quest: contentId("q-farm-vegetables") })
    )
    const restored = definition.create(testEnvironment())
    expect(restored.restore(game.save())).not.toBeInstanceOf(GameCommandError)
    expect(restored.state).toEqual(game.state)
    const save = structuredClone(game.save())
    const serialized = JSON.parse(JSON.stringify(save))
    serialized.snapshot.phase.townQuest = contentId("q-mole")
    expect(restored.restore(serialized)).toBeInstanceOf(GameCommandError)
    expect(restored.state).toEqual(game.state)
  })

  it("人数・戦闘不能・疲労・未解放・普通の依頼を拒否し、資産を保持", () => {
    const quest = contentId("q-town-crates")
    const states = [
      aState().withParty(["hero"]).build(),
      aState().withMember("hero", { hp: 0 }).build(),
      aState().withMember("hero", { fatigue: 100 }).build(),
    ]
    for (const state of states) {
      const game = createTestGame({ state })
      const save = game.save()
      expect(game.send({ type: "fight-quest", quest })).toBeInstanceOf(
        GameCommandError
      )
      expect(game.save()).toEqual(save)
    }
    const game = createTestGame()
    const save = game.save()
    for (const quest of [contentId("q-town-nest"), contentId("q-mole")]) {
      expect(game.send({ type: "fight-quest", quest })).toBeInstanceOf(
        GameCommandError
      )
      expect(game.save()).toEqual(save)
    }
    expect(game.send({ type: "accept-quest", quest })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.save()).toEqual(save)
  })
})

describe("戦う場所の鍵", () => {
  it("依頼の戦いは依頼の場所、探索の戦いは層を返す", () => {
    const { definition, game: original } = createTestPlay()
    for (const quest of definition.catalog.data.quests.filter(
      (entry) => entry.encounter
    )) {
      const game = definition.create(testEnvironment(), {
        ...original.state,
        reached: 2,
      })
      eventsOrThrow(game.send({ type: "fight-quest", quest: quest.id }))
      expect(game.queries.battle(game.state)?.place).toBe(
        quest.encounter!.place
      )
    }
    const game = createTestGame({
      state: aState()
        .inBattle({ expedition: { layer: "layer2" } })
        .build(),
    })
    expect(game.queries.battle(game.state)?.place).toBe(contentId("layer2"))
  })
})
