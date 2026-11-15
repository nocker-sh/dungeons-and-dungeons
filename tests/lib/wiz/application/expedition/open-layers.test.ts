import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { realContent } from "@/lib/wiz/testing/real-content"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"
import { startedState } from "@/lib/wiz/testing/started-state"
import { ContentError } from "@/lib/wiz/content/content-error"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"

const layers = realContent().layers
const open = realContent().openLayers ?? layers.length
/** 開いている中で一番深い層。 */
const deepest = layers[open - 1]

/** 一撃で決まる武器をそろえ、指定した層のボスの手前から始める。 */
function beforeBossOf(reached: number) {
  const bossHealth = realContent().foes.find(
    (foe) => foe.id === deepest.boss
  )!.hp
  const definition = new GameDefinition(
    aContent()
      .withWeaponPower(bossHealth * 3)
      .build()
  )
  const boss = deepest.stations.find((station) => station.boss)!
  const beforeBoss = deepest.stations.find((station) =>
    station.next.includes(boss.id)
  )!
  const base = startedState(definition)
  const game = definition.create(
    WizWorldEnvironment.create({
      random: () => 0.5,
      now: () => 0,
      nextId: () => "x",
    }),
    {
      ...base,
      reached,
      phase: {
        type: "expedition",
        expedition: {
          layer: deepest.id,
          at: beforeBoss.id,
          visited: [deepest.start, beforeBoss.id],
          events: [],
          pending: null,
          loot: { gold: 0, goods: [] },
          cleared: false,
        },
      },
    }
  )
  return { game, boss }
}

describe("開いている層の数", () => {
  it("作品データは、全ての層より手前で行き先を閉じている", () => {
    expect(open).toBeLessThan(layers.length)
  })

  it("[feature:W001] 開いている一番深い層のボスを倒しても、次の層は開かず踏破にもならない", () => {
    const { game, boss } = beforeBossOf(open - 1)
    eventsOrThrow(game.send({ type: "advance", to: boss.id }))
    const events = fightToEnd(game)
    expect(events).toContainEqual({
      type: "layer-cleared",
      layer: deepest.id,
      opened: null,
    })
    expect(events.some((event) => event.type === "game-cleared")).toBe(false)
    expect(game.state.reached).toBe(open - 1)
    expect(game.state.cleared).toBe(false)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    eventsOrThrow(game.send({ type: "retreat" }))
    // 踏破の場面は出ず、街へ戻る
    expect(game.queries.result(game.state)?.kind).not.toBe("ending")
    expect(
      game.queries.destinations(game.state).map((entry) => entry.id)
    ).toEqual(layers.slice(0, open).map((layer) => layer.id))
    // 同じ層へは何度でも出られる
    eventsOrThrow(game.send({ type: "depart", layer: deepest.id }))
  })

  it("[feature:W001] 先の層まで進んでいた古い保存でも、閉じた層へは出られず状態を変えない", () => {
    const { game } = beforeBossOf(layers.length - 1)
    eventsOrThrow(game.send({ type: "retreat" }))
    const before = game.state
    for (const layer of layers.slice(open)) {
      const result = game.send({ type: "depart", layer: layer.id })
      expect(result).toBeInstanceOf(GameCommandError)
      expect((result as GameCommandError).code).toBe("LOCKED")
    }
    expect(game.state).toBe(before)
    expect(
      game.queries.destinations(game.state).map((entry) => entry.id)
    ).toEqual(layers.slice(0, open).map((layer) => layer.id))
    expect(game.queries.defaultDestination(game.state)).toBe(deepest.id)
  })

  it("層の数を超える指定と、開いていない層から始める指定を拒否する", () => {
    expect(
      () =>
        new GameDefinition(
          aContent()
            .withOpenLayers(layers.length + 1)
            .build()
        )
    ).toThrow(ContentError)
    expect(
      () => new GameDefinition(aContent().withOpenLayers(1).withReached(1).build())
    ).toThrow(ContentError)
  })
})
