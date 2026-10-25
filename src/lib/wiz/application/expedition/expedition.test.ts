import { describe, expect, it } from "vite-plus/test"
import {
  aContent,
  contentId,
  foeBySlug,
  memberBySlug,
  realContent,
} from "@/lib/wiz/testing"
import {
  createTestPlay,
  eventsOrThrow,
  fightToEnd,
  startedState,
} from "@/lib/wiz/testing"
import {
  ContentError,
  GameCatalog,
  GameCommandError,
  GameDefinition,
  WizWorldEnvironment,
} from "@/lib/wiz"

describe("出撃と探索", () => {
  it("[feature:W001] 最初は0層だけに出られ、まだ「前回ここまで」はない", () => {
    const { game } = createTestPlay()
    const destinations = game.queries.destinations(game.state)
    expect(
      destinations.map((entry) => [entry.id, entry.open, entry.state])
    ).toEqual(
      realContent().layers.map((layer, index) => [
        layer.id,
        index === 0,
        index === 0 ? "ここから" : "未到達",
      ])
    )
    expect(game.queries.defaultDestination(game.state)).toBe(
      contentId("layer0")
    )
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "retreat" }))
    expect(game.queries.destinations(game.state)[0].state).toBe("前回ここまで")
  })

  it("[feature:W001] 到達していない層へは出られず、状態を変えない", () => {
    const { game } = createTestPlay()
    const before = game.state
    const result = game.send({ type: "depart", layer: contentId("layer2") })
    expect(result).toBeInstanceOf(GameCommandError)
    expect((result as GameCommandError).code).toBe("LOCKED")
    expect(game.state).toBe(before)
  })

  it("[feature:W002] 最初の地点は必ず戦闘になり、速さの順に並ぶ", () => {
    const { game } = createTestPlay()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    expect(game.queries.route(game.state)?.choices).toEqual(["n1"])
    const events = eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    expect(events.map((event) => event.type)).toEqual(["arrived", "encounter"])
    const order = game.queries
      .battle(game.state)!
      .order.map((entry) => entry.ref.id)
    // 行動順は速さの降順（同じ速さなら仲間が先）
    const speedOf = (id: string) =>
      id.startsWith("foe")
        ? (game.queries.battle(game.state)!.foes[0].spd ?? 0)
        : game.queries.member(game.state, id)!.spd
    expect(order.map(speedOf)).toEqual(
      order.map(speedOf).toSorted((a, b) => b - a)
    )
    expect(order.filter((id) => id.startsWith("foe")).length).toBe(
      game.queries.battle(game.state)!.foes.length
    )
    expect(order).toContain(memberBySlug("hero").id)
  })

  it("[feature:W002] 中ボスの地点では決まった敵が出て、倒しても層は終わらない", () => {
    const kamokutsu = foeBySlug("kamokutsu").id
    // 勝ち切るところまで見たいので、武器の攻撃力だけをそろえる
    const content = aContent()
      .withStation("layer0", "n1", {
        event: "midboss",
        foes: [kamokutsu, kamokutsu],
      })
      .withWeaponPower(400)
      .build()
    let serial = 0
    const midbossDefinition = new GameDefinition(content)
    const game = midbossDefinition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 1000,
        nextId: () => `id-${++serial}`,
      }),
      startedState(midbossDefinition)
    )
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const events = eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    expect(events).toContainEqual({
      type: "encounter",
      foes: [kamokutsu, kamokutsu],
      boss: false,
    })
    expect(game.queries.battle(game.state)).toMatchObject({
      boss: false,
      midboss: true,
    })
    fightToEnd(game)
    expect(game.state.phase.type).toBe("expedition")
    expect(game.queries.expedition(game.state)?.cleared).toBe(false)
  })

  it("中ボスの地点に敵がなければデータの誤りにする", () => {
    expect(
      () =>
        new GameCatalog(
          aContent().withStation("layer0", "n2", { event: "midboss" }).build()
        )
    ).toThrow(ContentError)
  })

  it("[feature:W002] 道のり図は終点までの最短の地点数を出す（分岐があっても数え違えない）", () => {
    const { game } = createTestPlay()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const layer = realContent().layers[0]
    // 分岐は上下どちらも同じ長さなので、最短は主線の地点数と同じ
    const main = layer.stations.filter((station) => station.y === 0)
    expect(game.queries.route(game.state)?.stepsLeft).toBe(
      main.length - 1 + (layer.stations.length - main.length) / 2
    )
  })

  it("[feature:W002] 隣の地点以外へは進めない", () => {
    const { game } = createTestPlay()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const result = game.send({ type: "advance", to: "n4" })
    expect((result as GameCommandError).code).toBe("NOT_NEXT")
  })

  it("[feature:W003] 撤退すると拾った物を持って街へ戻る", () => {
    const content = aContent()
      .withLayerFoes("layer0", ["hiyokobu"])
      .withLayer("layer0", { group: [1, 1] })
      .build()
    const { game } = createTestPlay(0.5, content)
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    fightToEnd(game)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    const gold = game.state.gold
    const events = eventsOrThrow(game.send({ type: "retreat" }))
    expect(events[0]).toMatchObject({ type: "returned", bonus: 0 })
    expect(game.state.phase.type).toBe("town")
    expect(game.state.gold).toBe(gold)
  })

  it("[feature:W003] 中ボスを倒してから戻ると、持ち帰る金貨に手当てが付く", () => {
    // 最初の地点を中ボスにして、balance.depth.retreatBonus を効かせる
    const retreatBonus = 0.5
    const content = aContent()
      .withStation("layer0", "n1", {
        event: "midboss",
        foes: [foeBySlug("kamokutsu").id],
      })
      .withBalance({
        depth: { ...realContent().balance.depth, retreatBonus },
      })
      .build()
    const definition = new GameDefinition(content)
    const game = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "x",
      }),
      startedState(definition)
    )
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    // 中ボスへ着く前は手当てがない
    expect(game.queries.route(game.state)?.bonus).toBe(0)
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    fightToEnd(game)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    const loot = game.queries.route(game.state)!.loot.gold
    const bonus = Math.floor(loot * retreatBonus)
    expect(bonus).toBeGreaterThan(0)
    expect(game.queries.route(game.state)?.bonus).toBe(bonus)
    const gold = game.state.gold
    const events = eventsOrThrow(game.send({ type: "retreat" }))
    expect(events[0]).toMatchObject({ type: "returned", bonus })
    expect(game.state.gold).toBe(gold + bonus)
  })
})
