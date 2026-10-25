import { describe, expect, it } from "vite-plus/test"
import { GameCommandError, type GameContent } from "@/lib/wiz"
import {
  aContent,
  aState,
  contentId,
  createTestGame,
  createTestPlay,
  eventsOrThrow,
  testEnvironment,
} from "@/lib/wiz/testing"

/** 迂回路と戻る線がある道のり。s から v→w→終点が最短（3地点）。 */
const stations: GameContent["layers"][number]["stations"] = [
  { id: "s", x: 0, y: 0, next: ["a", "v"] },
  { id: "a", x: 1, y: -1, next: ["a2"] },
  { id: "a2", x: 2, y: -1, next: ["w"] },
  { id: "w", x: 3, y: 0, next: ["v", "b"] },
  { id: "v", x: 1, y: 1, next: ["w", "l1"] },
  { id: "l1", x: 2, y: 2, next: ["l2"] },
  { id: "l2", x: 3, y: 2, next: ["b"] },
  { id: "b", x: 4, y: 0, next: [], boss: true },
]

function routeOf(content: GameContent, at: string) {
  const state = aState(content)
    .inExpedition({ at, visited: [at] })
    .build()
  const game = createTestGame({ content, state })
  return game.queries.route(game.state)!
}

describe("道のり図の見え方（hunt）", () => {
  it("抱えた素材や道具をガラクタと重複せず個数で数える", () => {
    const state = aState()
      .withGold(1234)
      .withBag([
        { good: contentId("junk"), count: 2 },
        { good: contentId("rare-junk"), count: 3 },
        { good: contentId("bone"), count: 5 },
        { good: contentId("potion"), count: 2 },
      ])
      .inExpedition({
        loot: {
          gold: 1234,
          goods: [
            { good: contentId("junk"), count: 2 },
            { good: contentId("rare-junk"), count: 3 },
            { good: contentId("bone"), count: 4 },
            { good: contentId("potion"), count: 2 },
            { good: contentId("bone"), count: 1 },
          ],
        },
      })
      .build()
    const game = createTestGame({ state })
    expect(game.queries.route(game.state)!.carrying).toEqual({
      gold: 1234,
      junk: 2,
      rareJunk: 3,
      otherGoods: 7,
      unequippedGear: 0,
    })
    expect(routeOf(aContent().build(), "s").carrying.otherGoods).toBe(0)
  })

  it("拾った道具を使い切ったら、入手履歴に残っていても抱えた物へ数えない", () => {
    const potion = contentId("potion")
    const state = aState()
      .withMembers({ hp: 1 })
      .withBag([{ good: potion, count: 1 }])
      .inExpedition({ loot: { gold: 0, goods: [{ good: potion, count: 1 }] } })
      .build()
    const game = createTestGame({ state })
    expect(game.queries.route(game.state)!.carrying.otherGoods).toBe(1)
    eventsOrThrow(
      game.send({ type: "use", good: potion, member: state.party[0] })
    )
    expect(game.queries.route(game.state)!.carrying.otherGoods).toBe(0)
    expect(game.queries.carried(game.state)!.goods).toEqual([])
  })

  it("金貨を支払った後の帰還所持金は実際の撤退結果と一致する", () => {
    const content = aContent().build()
    const midboss = content.layers[0].stations.find(
      (station) => station.event === "midboss"
    )!
    const state = aState(content)
      .withGold(50)
      .withBag([])
      .inExpedition({
        at: "n3",
        visited: ["s", "n3", midboss.id],
        pending: { kind: "discovery" },
        loot: { gold: 50, goods: [] },
      })
      .build()
    const game = createTestGame({ content, state })
    eventsOrThrow(game.send({ type: "discover", choice: "goods" }))
    expect(game.state.gold).toBe(0)
    const route = game.queries.route(game.state)!
    expect(route.carrying.gold).toBe(0)
    expect(route.returnBalance).toBe(route.bonus)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    eventsOrThrow(game.send({ type: "retreat" }))
    expect(game.state.gold).toBe(route.returnBalance)
  })

  it("今回拾った未装備の個体だけを数え、装備済みと以前の品を除く", () => {
    const content = aContent().build()
    const weapon = content.goods.find((good) => good.kind === "weapon")!
    const base = aState(content).build()
    const equipped = aState(content)
      .withEquipped(base.party[0], weapon.id)
      .build()
    const original = equipped.gear.find((gear) => gear.owner === base.party[0])!
    const state = aState(content)
      .withGear([
        ...equipped.gear,
        { ...original, id: "picked-1", owner: null },
        { ...original, id: "picked-2", owner: null },
        { ...original, id: "old-gear", owner: null },
      ])
      .inExpedition({
        loot: {
          gold: 0,
          goods: [],
          weapons: [original.id, "picked-1", "picked-2", "picked-2"],
        },
      })
      .build()
    const game = createTestGame({ content, state })
    expect(game.queries.route(game.state)!.carrying.unequippedGear).toBe(2)
  })
  it("終点から数えた最短の地点数を返す", () => {
    const content = aContent().build()
    const layer = content.layers[0]
    const boss = layer.stations.find((station) => station.boss)!
    // 終点は0で、どの地点も「次の地点のうち一番近いもの＋1」になる
    expect(routeOf(content, boss.id).stepsLeft).toBe(0)
    const leftOf = new Map(
      layer.stations.map((station) => [
        station.id,
        routeOf(content, station.id).stepsLeft,
      ])
    )
    for (const station of layer.stations) {
      if (station.id === boss.id) continue
      const nearest = Math.min(
        ...station.next.map((id) => leftOf.get(id) ?? Number.POSITIVE_INFINITY)
      )
      expect(leftOf.get(station.id), station.id).toBe(nearest + 1)
    }
    expect(leftOf.get(layer.start)).toBeGreaterThan(0)
  })

  it("戻る線がある道のりでも、遠回りの枝を先に数えても最短を返す", () => {
    const content = aContent().withLayer("layer0", { stations }).build()
    expect(routeOf(content, "b").stepsLeft).toBe(0)
    expect(routeOf(content, "w").stepsLeft).toBe(1)
    expect(routeOf(content, "v").stepsLeft).toBe(2)
    expect(routeOf(content, "a2").stepsLeft).toBe(2)
    expect(routeOf(content, "a").stepsLeft).toBe(3)
    // s → v → w → 終点。遠回りの s → a → a2 → w → 終点（4地点）ではない
    expect(routeOf(content, "s").stepsLeft).toBe(3)
  })

  it("終点へ着けない地点は無限のままにする", () => {
    const content = aContent()
      .withLayer("layer0", {
        stations: [
          { id: "s", x: 0, y: 0, next: ["dead"] },
          { id: "dead", x: 1, y: 0, next: ["s"] },
          { id: "b", x: 2, y: 0, next: [], boss: true },
        ],
      })
      .build()
    expect(routeOf(content, "s").stepsLeft).toBe(Number.POSITIVE_INFINITY)
  })

  // 道のりは合流しない木に広がるので地点が多い。全部を試すので待つ時間を長めに取る
  it(
    "分岐の選択肢は、いまの地点から実際に進める地点と一致する",
    { timeout: 30000 },
    () => {
      const content = aContent().build()
      const { definition } = createTestPlay(0.5, content)
      for (const at of ["s", "n4", "u5", "n7", "n8"]) {
        const route = routeOf(content, at)
        const state = aState(content)
          .inExpedition({ at, visited: [at] })
          .build()
        for (const station of route.stations) {
          const game = definition.create(
            testEnvironment({ random: 0.5 }),
            state
          )
          const result = game.send({ type: "advance", to: station.id })
          const allowed = route.choices.includes(station.id)
          expect(
            !(result instanceof GameCommandError),
            `${at} → ${station.id}`
          ).toBe(allowed)
        }
      }
    }
  )

  it("終点では atEnd が立ち、進めない", () => {
    const content = aContent().build()
    const boss = content.layers[0].stations.find((station) => station.boss)!
    const end = routeOf(content, boss.id)
    expect(end.atEnd).toBe(true)
    expect(end.choices).toEqual([])
    const middle = routeOf(content, "n4")
    expect(middle.atEnd).toBe(false)
    expect(middle.choices).toEqual(["u5", "l5"])
  })

  it("通った地点と出来事が道のり図に出る", () => {
    const game = createTestGame({ random: () => 0.01 })
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const route = game.queries.route(game.state)!
    const n1 = route.stations.find((station) => station.id === "n1")!
    expect(n1.visited).toBe(true)
    expect(n1.event).toBe("battle")
    const n2 = route.stations.find((station) => station.id === "n2")!
    expect(n2.visited).toBe(false)
    expect(n2.event).toBe(null)
  })

  it("中ボスの地点は着く前から印が出る", () => {
    const content = aContent()
      .withStation("layer0", "n7", {
        event: "midboss",
        discovery: undefined,
        foes: [contentId("haribote-adult")],
      })
      .build()
    const route = routeOf(content, "s")
    expect(route.stations.find((station) => station.id === "n7")?.midboss).toBe(
      true
    )
    // 出来事を決めていない地点には印が出ない
    expect(route.stations.find((station) => station.id === "n2")?.midboss).toBe(
      false
    )
  })

  it("街では道のり図も探索も null", () => {
    const game = createTestGame()
    expect(game.queries.route(game.state)).toBe(null)
    expect(game.queries.expedition(game.state)).toBe(null)
  })

  it("行き先の開いている層だけ出撃できる", () => {
    for (const reached of [0, 1, 4]) {
      const state = aState().withReached(reached).build()
      for (const destination of createTestGame({ state }).queries.destinations(
        state
      )) {
        const game = createTestGame({ state })
        const result = game.send({ type: "depart", layer: destination.id })
        expect(
          !(result instanceof GameCommandError),
          `reached ${reached} / ${destination.id}`
        ).toBe(destination.open)
        if (!destination.open) {
          expect((result as GameCommandError).code).toBe("LOCKED")
          expect(destination.name).toBe("？？？")
        }
      }
    }
  })

  it("最初に選ぶ層は、前回の層か到達している一番深い層", () => {
    const fresh = aState().withReached(2).build()
    const game = createTestGame({ state: fresh })
    expect(game.queries.defaultDestination(fresh)).toBe(contentId("layer2"))
    expect(
      game.send({
        type: "depart",
        layer: game.queries.defaultDestination(fresh),
      })
    ).not.toBeInstanceOf(GameCommandError)
    const back = { ...game.state, phase: { type: "town" } as const }
    expect(game.queries.defaultDestination(back)).toBe(contentId("layer2"))
  })
  it("中ボスへの距離は分岐の最短を返し、通過済みと到達不能は表示しない", () => {
    const content = aContent()
      .withLayer("layer0", {
        stations: stations.map((station) =>
          station.id === "w"
            ? {
                ...station,
                event: "midboss" as const,
                foes: [contentId("haribote")],
              }
            : station
        ),
      })
      .build()
    expect(routeOf(content, "s").midbossSteps).toBe(2)
    expect(routeOf(content, "a").midbossSteps).toBe(2)
    expect(routeOf(content, "v").midbossSteps).toBe(1)
    expect(routeOf(content, "w").midbossSteps).toBeNull()
    expect(routeOf(content, "b").midbossSteps).toBeNull()
    const state = aState(content)
      .inExpedition({ at: "s", visited: ["s", "w"] })
      .build()
    const game = createTestGame({ content, state })
    expect(game.queries.route(game.state)?.midbossSteps).toBeNull()
  })
})
