import { Bag } from "@/lib/wiz/rules/bag"
import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { createStudioStart } from "@/development/studio/create-studio-start"
import { studioScenes } from "@/development/studio/scenarios"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { layoutPatterns } from "@/development/studio/layout-pattern"

describe("ゲームと共通の開始状態", () => {
  it("場面のパスが重複しない", () => {
    expect(new Set(studioScenes.map((entry) => entry.slug)).size).toBe(
      studioScenes.length
    )
  })
  it.each(studioScenes)("$slug がエンジンの検証を通して起動する", (scene) => {
    const config = parseStudioConfig({ scene: scene.slug })
    const start = createStudioStart(config)
    const game = new GameDefinition(start.content!).create(
      start.environment,
      start.initialState
    )
    if (start.save) expect(game.restore(start.save), scene.slug).toBeUndefined()
    expect(game.queries.party(game.state)).toHaveLength(3)
  })
  it("戦闘以外の保存付きシナリオでも隊列と種を反映する", () => {
    const config = parseStudioConfig({
      scene: "route-loot",
      party: ["hero", "rivet", "mayu"],
      seed: 77,
    })
    const first = createStudioStart(config)
    const repeat = createStudioStart(config)
    expect(first.save).toEqual(repeat.save)
    const game = new GameDefinition(first.content!).create(first.environment)
    expect(game.restore(first.save)).toBeUndefined()
    expect(game.queries.party(game.state).map((entry) => entry.name)).toEqual([
      "あなた",
      "リベット",
      "マユ",
    ])
    expect(game.queries.route(game.state)?.pending?.kind).toBe("loot")
    const result = inPhase(game, "pending")?.acknowledge()
    expect(result).toBeDefined()
  })
  it("レア戦利品の展示でも光るガラクタを受け取り、帰還して持ち帰れる", () => {
    const start = createStudioStart(
      parseStudioConfig({ scene: "route-loot-rare" })
    )
    const game = new GameDefinition(start.content!).create(start.environment)
    expect(game.restore(start.save)).toBeUndefined()
    const rare = start.content!.rareJunk!
    expect(Bag.count(game.state.bag, rare)).toBe(1)
    expect(game.queries.route(game.state)?.carrying.rareJunk).toBe(1)
    expect(inPhase(game, "pending")?.acknowledge()).toBeDefined()
    expect(game.queries.route(game.state)?.carrying.rareJunk).toBe(1)
    expect(inPhase(game, "expedition")?.retreat()).toBeDefined()
    expect(game.state.phase.type).toBe("town")
    expect(Bag.count(game.state.bag, rare)).toBe(1)
  })
  it("宝箱の分岐から、分岐・宝箱・拾い物の会話を順に開始できる", () => {
    const start = createStudioStart(
      parseStudioConfig({ scene: "route-chest-branch" })
    )
    const game = new GameDefinition(start.content!).create(start.environment)
    expect(game.restore(start.save)).toBeUndefined()
    const route = game.queries.route(game.state)!
    expect(route.pending).toBeNull()
    expect(route.choices.length).toBeGreaterThan(1)
    const layer = start.content!.layers.find(
      (entry) => entry.id === route.layer.id
    )!
    const chest = layer.stations.find(
      (entry) => route.choices.includes(entry.id) && entry.event === "treasure"
    )!
    expect(chest).toBeDefined()
    expect(
      inPhase(game, "expedition")?.startConversation("branch")
    ).toMatchObject({ next: { kind: "conversation" } })
    expect(game.queries.activeConversation(game.state)?.trigger).toBe("branch")
    expect(
      inPhase(game, "conversation")?.finish(
        game.queries.activeConversation(game.state)?.choice ? 0 : undefined
      )
    ).toMatchObject({ next: { kind: "expedition" } })
    expect(inPhase(game, "expedition")?.advance(chest.id)).toMatchObject({
      next: { kind: "pending" },
    })
    expect(game.queries.route(game.state)?.pending?.kind).toBe("treasure")
    for (const trigger of ["chest", "item"] as const) {
      expect(
        inPhase(game, "pending")?.startConversation(trigger)
      ).toMatchObject({
        next: { kind: "conversation" },
      })
      expect(game.queries.activeConversation(game.state)?.trigger).toBe(trigger)
      expect(
        inPhase(game, "conversation")?.finish(
          game.queries.activeConversation(game.state)?.choice ? 0 : undefined
        )
      ).toMatchObject({ next: { kind: "pending" } })
    }
    expect(inPhase(game, "pending")?.acknowledge()).toMatchObject({
      next: { kind: "expedition" },
    })
    expect(game.queries.route(game.state)?.pending).toBeNull()
  })
  it("中ボス後の帰還表示の合計が実際の金貨と一致し、二重加算しない", () => {
    const start = createStudioStart(
      parseStudioConfig({ scene: "route-retreat-bonus" })
    )
    const game = new GameDefinition(start.content!).create(start.environment)
    expect(game.restore(start.save)).toBeUndefined()
    const route = game.queries.route(game.state)!
    expect(route.passedMidboss).toBe(true)
    expect(route.pending).toBeNull()
    expect(route.atEnd).toBe(false)
    expect(route.bonus).toBeGreaterThan(0)
    expect(route.returnGold).toBe(route.carrying.gold + route.bonus)
    const goldBeforeExpedition = game.state.gold - route.carrying.gold
    const bag = game.state.bag
    const saved = game.save()
    expect(game.restore(saved)).toBeUndefined()
    expect(game.queries.route(game.state)?.returnGold).toBe(route.returnGold)
    expect(inPhase(game, "expedition")?.retreat()).toBeDefined()
    expect(game.state.phase.type).toBe("town")
    expect(game.state.gold).toBe(goldBeforeExpedition + route.returnGold)
    expect(game.state.bag).toEqual(bag)
  })
  it("持ち帰りQueryは出撃前の品を除き、落ちた武器の個体とガラクタを保存後も表示する", () => {
    const start = createStudioStart(
      parseStudioConfig({ scene: "route-loot-rare" })
    )
    const game = new GameDefinition(start.content!).create(start.environment)
    expect(game.restore(start.save)).toBeUndefined()
    const saved = game.save()
    const carried = game.queries.carried(game.state)!
    const phase = saved.snapshot.phase
    if (phase.type !== "expedition") throw new Error("探索の戦利品が必要")
    const loot = phase.expedition.loot
    expect(loot.gold).toBeGreaterThan(0)
    expect(carried.gold).toBe(loot.gold)
    expect(
      carried.goods.map((entry) => ({ good: entry.id, count: entry.count }))
    ).toEqual(loot.goods)
    expect(carried.gear).toHaveLength(1)
    expect(carried.gear[0]).toMatchObject({
      gear: "preview-drop",
      rarity: "SR",
    })
    expect(game.save()).toEqual(saved)
    expect(game.restore(saved)).toBeUndefined()
    expect(game.queries.carried(game.state)).toEqual(carried)
    const material = carried.goods.find((entry) => entry.name === "洞窟の結晶")!
    expect(
      game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          bag: Bag.remove(saved.snapshot.bag, material.id, material.count)!,
        },
      })
    ).toBeUndefined()
    expect(game.queries.carried(game.state)?.goods).toEqual(
      carried.goods.filter((entry) => entry.id !== material.id)
    )
    expect(game.restore(saved)).toBeUndefined()
    expect(inPhase(game, "pending")?.acknowledge()).toBeDefined()
    expect(inPhase(game, "expedition")?.retreat()).toBeDefined()
    expect(game.queries.carried(game.state)).toBeNull()
  })
  it("場面の台本を共通設定へ入れ、明示的な空の操作も保持する", () => {
    for (const pattern of layoutPatterns) {
      const config = parseStudioConfig({ scene: pattern.slug })
      expect(config.actions).toEqual(pattern.actions)
      expect(config.duration).toBeGreaterThanOrEqual(pattern.at)
    }
    expect(
      parseStudioConfig({ scene: "guild-talk", actions: [] }).actions
    ).toEqual([])
  })
})
