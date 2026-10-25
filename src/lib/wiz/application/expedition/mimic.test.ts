import { describe, expect, it } from "vite-plus/test"
import { GameCatalog } from "@/lib/wiz"
import { ExpeditionRules } from "@/lib/wiz/rules/expedition-rules"
import {
  aContent,
  aState,
  createTestGame,
  eventsOrThrow,
  fightToEnd,
  realContent,
} from "@/lib/wiz/testing"

describe("宝箱に潜むミミック", () => {
  it("ミミックを倒してから戦利品を得る。宝箱として二重精算しない", () => {
    const content = aContent().withWeaponPower(10000).build()
    const layer = content.layers[0]
    const mimic = layer.treasure.mimic!
    const game = createTestGame({
      content,
      random: 0,
      state: aState(content)
        .inBattle({ foes: [mimic.foe] })
        .build(),
    })
    const events = fightToEnd(game)
    const victories = events.filter((event) => event.type === "victory")
    expect(victories).toHaveLength(1)
    expect(events.some((event) => event.type === "treasure")).toBe(false)
    expect(game.state.phase.type).toBe("expedition")
    if (game.state.phase.type !== "expedition")
      throw new Error("探索に戻っていない")
    expect(game.state.phase.expedition.pending?.kind).toBe("loot")
    const gold = game.state.gold
    eventsOrThrow(game.send({ type: "acknowledge" }))
    expect(game.state.gold).toBe(gold)
    expect(game.state.phase.expedition.pending).toBeNull()
  })
  it.each([0, 1, 2, 3, 4])("%s層の宝箱から対応するミミックが出る", (index) => {
    const content = realContent()
    const layer = content.layers[index]
    const mimic = layer.treasure.mimic!
    const station = layer.stations.find(
      (entry) => !entry.event && !entry.boss && entry.id !== layer.start
    )!
    const source = layer.stations.find((entry) =>
      entry.next.includes(station.id)
    )!
    const state = aState()
      .inExpedition({ layer: layer.id, at: source.id })
      .build()
    const game = createTestGame({
      state,
      random: 0,
      content: aContent()
        .withStation(layer.id, station.id, {
          weights: { battle: 0, treasure: 1, trap: 0, discovery: 0 },
        })
        .build(),
    })
    const before = game.state
    const events = eventsOrThrow(game.send({ type: "advance", to: station.id }))
    expect(events).toContainEqual({
      type: "arrived",
      station: station.id,
      kind: "treasure",
    })
    expect(events).toContainEqual({
      type: "encounter",
      foes: [mimic.foe],
      boss: false,
    })
    expect(events.some((event) => event.type === "treasure")).toBe(false)
    expect(game.state.gold).toBe(before.gold)
    expect(game.state.bag).toEqual(before.bag)
    expect(game.state.phase.type).toBe("battle")
    if (game.state.phase.type !== "battle")
      throw new Error("戦闘になっていない")
    expect(game.state.phase.battle.foes[0].foe).toBe(mimic.foe)
    expect(game.state.phase.expedition.pending).toBeNull()
    const resumed = createTestGame({ state: game.state })
    expect(resumed.state.phase).toEqual(game.state.phase)
  })

  it("固定の宝箱と確定報酬をミミックに変えない", () => {
    const catalog = new GameCatalog(realContent())
    const layer = catalog.data.layers[0]
    const rules = new ExpeditionRules(catalog)
    for (const station of layer.stations.filter(
      (entry) => entry.event === "treasure"
    ))
      expect(rules.mimic(layer, station, () => 0)).toBeNull()
    expect(
      rules.mimic(
        layer,
        {
          ...layer.stations[0],
          rewardGoods: [{ good: layer.treasure.goods[0].good, count: 1 }],
        },
        () => 0
      )
    ).toBeNull()
  })

  it("抽選から外れた宝箱は従来の報酬を受け取れる", () => {
    const layer = realContent().layers[0]
    const station = layer.stations.find(
      (entry) => !entry.event && !entry.boss && entry.id !== layer.start
    )!
    const source = layer.stations.find((entry) =>
      entry.next.includes(station.id)
    )!
    const content = aContent()
      .withStation(layer.id, station.id, {
        weights: { battle: 0, treasure: 1, trap: 0, discovery: 0 },
      })
      .build()
    const game = createTestGame({
      content,
      random: 0.9,
      state: aState().inExpedition({ layer: layer.id, at: source.id }).build(),
    })
    const events = eventsOrThrow(game.send({ type: "advance", to: station.id }))
    expect(events.some((event) => event.type === "treasure")).toBe(true)
    expect(game.state.phase.type).toBe("expedition")
  })
})
