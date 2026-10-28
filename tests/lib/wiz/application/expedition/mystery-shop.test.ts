import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { Bag } from "@/lib/wiz/rules/bag"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const junk = contentId("junk")
const book = "49c06f75-74e8-4a31-a9bb-d6b09e96d001"
const at = (station: string) =>
  aState().inExpedition({
    at: station,
    visited: ["s", station],
    pending: { kind: "discovery" },
  })

describe("手掛かりから選ぶ未知の道と魔物の取引", () => {
  it("見るだけでは抽選せず、危険度と手掛かりだけを見せる", () => {
    let calls = 0
    const game = createTestGame({
      state: aState()
        .inExpedition({ at: "n2", visited: ["s", "n2"] })
        .build(),
      random: () => {
        calls++
        return 0.9
      },
    })
    const before = calls
    const paths = game.queries.route(game.state)!.paths
    expect(paths.map((path) => path.danger)).toEqual(["低", "不明"])
    expect(paths[1].hint).toContain("車輪")
    expect(paths[1].details.join(" ")).not.toContain("スキルの書")
    expect(paths[0].details.join(" ")).not.toContain("35")
    expect(calls).toBe(before)
  })

  it.each([
    [0.1, "battle"],
    [0.4, "treasure"],
    [0.7, "trap"],
    [0.9, "discovery"],
  ] as const)(
    "未知の道は乱数%sで%sになり、保存しても結果が変わらない",
    (random, kind) => {
      const game = createTestGame({
        state: aState()
          .inExpedition({ at: "n2", visited: ["s", "n2"] })
          .build(),
        random,
      })
      eventsOrThrow(game.send({ type: "advance", to: "m3" }))
      expect(game.queries.expedition(game.state)!.events.at(-1)?.kind).toBe(
        kind
      )
      const snapshot = game.state
      expect(game.restore(game.save())).toBeUndefined()
      expect(game.state).toEqual(snapshot)
      if (kind === "discovery")
        expect(game.queries.route(game.state)!.discovery?.title).toBe(
          "魔物の交換屋"
        )
    }
  )

  it("金貨で商品を一度だけ買え、不足時は何も失わず立ち去れる", () => {
    const game = createTestGame({
      state: at("n3").withGold(50).withBag([]).build(),
    })
    eventsOrThrow(game.send({ type: "discover", choice: "goods" }))
    expect(game.state.gold).toBe(0)
    expect(Bag.count(game.state.bag, junk)).toBe(3)
    const bought = game.state
    expect(game.send({ type: "discover", choice: "goods" })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(bought)
    const poor = createTestGame({ state: at("n3").withGold(0).build() })
    const before = poor.state
    expect(
      poor.queries
        .route(poor.state)!
        .discovery!.choices.find((choice) => choice.id === "goods")!.available
    ).toBe(false)
    expect(poor.send({ type: "discover", choice: "goods" })).toBeInstanceOf(
      GameCommandError
    )
    expect(poor.state).toBe(before)
    eventsOrThrow(poor.send({ type: "discover", choice: "leave" }))
    expect(poor.state.gold).toBe(0)
  })

  it("交換は戦利品からも支払い、消費済みの物を全滅時の没収対象に残さない", () => {
    const state = at("m3")
      .withBag([{ good: junk, count: 3 }])
      .build()
    if (state.phase.type !== "expedition") throw new Error("fixture")
    const game = createTestGame({
      state: {
        ...state,
        phase: {
          ...state.phase,
          expedition: {
            ...state.phase.expedition,
            loot: { gold: 0, goods: [{ good: junk, count: 2 }] },
          },
        },
      },
    })
    eventsOrThrow(game.send({ type: "discover", choice: "trade" }))
    expect(Bag.count(game.state.bag, junk)).toBe(1)
    expect(Bag.count(game.state.bag, book)).toBe(1)
    expect(game.queries.expedition(game.state)!.loot.goods).toEqual([
      { good: book, count: 1 },
    ])
    expect(game.restore(game.save())).toBeUndefined()
    const poor = createTestGame({ state: at("m3").withBag([]).build() })
    const before = poor.state
    expect(poor.send({ type: "discover", choice: "trade" })).toBeInstanceOf(
      GameCommandError
    )
    expect(poor.state).toBe(before)
  })

  it("HP取引も表示どおり支払い、倒れる取引は拒否する", () => {
    const game = createTestGame({ state: at("m3").build() })
    const payment = game.queries
      .route(game.state)!
      .discovery!.choices.find((choice) => choice.id === "blood")!.payment
    eventsOrThrow(game.send({ type: "discover", choice: "blood" }))
    for (const entry of payment)
      expect(
        game.state.members.find((member) => member.id === entry.id)!.hp
      ).toBe(entry.after)
    const hurt = createTestGame({
      state: at("m3").withMember("alda", { hp: 1 }).build(),
    })
    const before = hurt.state
    expect(hurt.send({ type: "discover", choice: "blood" })).toBeInstanceOf(
      GameCommandError
    )
    expect(hurt.state).toBe(before)
  })

  it("どの層も5つの分岐を持ち、全経路で中ボスと16歩目のボスを通る", () => {
    for (const layer of realContent().layers) {
      expect(
        layer.stations.filter((station) => station.next.length > 1)
      ).toHaveLength(5)
      const walk = (id: string, visited: string[]) => {
        const station = layer.stations.find((entry) => entry.id === id)!
        if (station.boss) {
          expect(visited).toHaveLength(16)
          expect(visited).toContain("n8")
          return
        }
        for (const next of station.next) walk(next, [...visited, id])
      }
      walk(layer.start, [])
    }
  })
})
