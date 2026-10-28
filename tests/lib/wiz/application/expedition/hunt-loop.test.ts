import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { Bag } from "@/lib/wiz/rules/bag"
import { SupplyRules } from "@/lib/wiz/rules/supply-rules"

const potion = contentId("potion")
const junk = realContent().junk

describe("持ち出しと探索の選択", () => {
  it("8個を超える持ち出しと探索中の積み替えは拒否し、在庫を失わない", () => {
    const game = createTestGame({
      state: aState()
        .withBag([{ good: potion, count: 20 }])
        .build(),
    })
    eventsOrThrow(game.send({ type: "pack", good: potion, count: 8 }))
    const before = game.state
    expect(game.send({ type: "pack", good: potion, count: 9 })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(before)
    expect(game.queries.supplies(game.state).items[0]).toMatchObject({
      carried: 8,
      stored: 12,
    })
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    expect(game.send({ type: "pack", good: potion, count: 0 })).toBeInstanceOf(
      GameCommandError
    )
    expect(
      game.queries.items(game.state).find((item) => item.id === potion)?.count
    ).toBe(8)
  })

  it("手持ちを使い切ると倉庫に残る同じ薬も使えず、帰還後に詰め直せる", () => {
    const game = createTestGame({
      state: aState()
        .withMember("alda", { hp: 1 })
        .withBag([{ good: potion, count: 20 }])
        .build(),
    })
    eventsOrThrow(game.send({ type: "pack", good: potion, count: 1 }))
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(
      game.send({ type: "use", good: potion, member: contentId("alda") })
    )
    const before = game.state
    expect(
      game.send({ type: "use", good: potion, member: contentId("alda") })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
    expect(Bag.count(game.state.bag, potion)).toBe(19)
    expect(game.queries.supplies(game.state).count).toBe(0)
    eventsOrThrow(game.send({ type: "retreat" }))
    eventsOrThrow(game.send({ type: "pack", good: potion, count: 8 }))
    expect(game.queries.supplies(game.state).count).toBe(8)
    const save = game.save()
    expect(game.restore(save)).toBeUndefined()
    expect(game.queries.supplies(game.state).count).toBe(8)
  })

  it("戦闘でも手持ちだけが使え、消費を保存する", () => {
    const base = aState()
      .withBag([{ good: potion, count: 12 }])
      .withMember("alda", { hp: 1 })
      .inBattle({
        foes: ["kamokutsu"],
        order: ["hero", "foe-1", "alda", "mort"],
      })
      .build()
    const game = createTestGame({
      state: { ...base, provisions: [{ good: potion, count: 1 }] },
    })
    eventsOrThrow(
      game.send({
        type: "act",
        command: "item",
        good: potion,
        target: contentId("alda"),
      })
    )
    expect(Bag.count(game.state.bag, potion)).toBe(11)
    expect(
      SupplyRules.packed(game.state, new GameDefinition(realContent()).catalog)
    ).toEqual([])
  })

  it("休息と戦利品は排他的。回復は上限内で、控え・倒れた仲間は回復しない", () => {
    const base = aState()
      .withMember("alda", { hp: 1, fatigue: 40 })
      .withMember("mort", { hp: 0 })
      .inExpedition({ at: "n4", visited: ["s", "n4"] })
      .build()
    const game = createTestGame({ state: base })
    eventsOrThrow(game.send({ type: "advance", to: "l5" }))
    expect(
      game.queries
        .route(game.state)
        ?.discovery?.choices.map((choice) => choice.id)
    ).toEqual(["rest", "salvage", "blessing"])
    expect(game.send({ type: "acknowledge" })).toBeInstanceOf(GameCommandError)
    const before = Bag.count(game.state.bag, junk)
    eventsOrThrow(game.send({ type: "discover", choice: "rest" }))
    expect(
      game.queries.member(game.state, contentId("alda"))!.hp
    ).toBeGreaterThan(1)
    expect(game.queries.member(game.state, contentId("mort"))!.hp).toBe(0)
    expect(Bag.count(game.state.bag, junk)).toBe(before)
    expect(game.send({ type: "discover", choice: "salvage" })).toBeInstanceOf(
      GameCommandError
    )
  })

  it("宝箱は金貨不足で変化せず、HPを払う選択は一度だけ4個を得る", () => {
    const game = createTestGame({
      state: aState()
        .withGold(0)
        .inExpedition({ at: "n9", visited: ["s", "n9"] })
        .build(),
    })
    eventsOrThrow(game.send({ type: "advance", to: "l10" }))
    const before = game.state
    expect(game.send({ type: "discover", choice: "tools" })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(before)
    const count = Bag.count(game.state.bag, junk)
    eventsOrThrow(game.send({ type: "discover", choice: "force" }))
    expect(Bag.count(game.state.bag, junk)).toBe(count + 4)
    expect(
      game.queries
        .party(game.state)
        .every((member) => member.hp > 0 && member.hp < member.maxHp)
    ).toBe(true)
    expect(game.send({ type: "discover", choice: "force" })).toBeInstanceOf(
      GameCommandError
    )
  })

  it("各層の5分岐はどちらを選んでも16歩で終点へ着く", () => {
    for (const layer of realContent().layers) {
      expect(
        layer.stations.filter((station) => station.next.length > 1)
      ).toHaveLength(5)
      const walk = (id: string, steps: number) => {
        const station = layer.stations.find((entry) => entry.id === id)!
        if (station.boss) {
          expect(steps).toBe(16)
          return
        }
        for (const next of station.next) walk(next, steps + 1)
      }
      walk(layer.start, 0)
    }
  })

  it("初回募集を逆順で雇っても前衛に守り役、後衛に回復役が揃い、そろった後の募集は控えに入る", () => {
    const game = createTestGame({
      fresh: true,
      content: { ...realContent(), startingCompanions: [] },
    })
    eventsOrThrow(
      game.send({
        type: "create-hero",
        name: "ボウケンシャ",
        look: game.queries.hero(game.state).looks[0].id,
      })
    )
    const recruits = game.queries.recruits(game.state)
    const recruitOf = (slug: string) =>
      recruits.find((recruit) => recruit.member === contentId(slug))!.id
    // 回復役→守り役の順に雇っても、そろったときに守り役が前衛へ入る
    for (const slug of ["mort", "alda"])
      eventsOrThrow(game.send({ type: "recruit", recruit: recruitOf(slug) }))
    expect(
      game.queries.party(game.state).map((member) => [member.role, member.row])
    ).toEqual([
      ["summoner", "front"],
      ["tank", "front"],
      ["healer", "back"],
    ])
    const lineup = game.state.party
    eventsOrThrow(game.send({ type: "recruit", recruit: recruitOf("mayu") }))
    expect(game.state.party).toEqual(lineup)
    expect(game.queries.reserve(game.state).map((member) => member.id)).toEqual(
      [contentId("mayu")]
    )
    const { definition } = createTestPlay()
    const party = game.state.party.map((id) =>
      game.state.members.find((member) => member.id === id)!
    )
    // 同じ抽選値でも、前衛の守り役に攻撃が向く範囲が広い。
    expect(definition.rules.battle.target(party, () => 0.7)?.id).toBe(
      contentId("alda")
    )
  })
})
