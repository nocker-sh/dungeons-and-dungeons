import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/lib/content/game-content"
import {
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
} from "@/lib/wiz/testing"
import { Bag } from "@/lib/wiz/rules"

const member = contentId("hero")

describe("回復・強化の道具", () => {
  it("店に並ぶ道具はすべて実行できる効果を持つ", () => {
    const sold = new Set(gameContent.shops.flatMap((shop) => shop.goods))
    for (const good of gameContent.goods.filter(
      (entry) => entry.kind === "item" && sold.has(entry.id)
    ))
      expect(good.effect, good.name).toBeDefined()
  })

  it("全体回復薬は傷ついた全員を回復し、満タンなら消費しない", () => {
    const initial = aState().withItem("group-potion", 2).build()
    const game = createTestGame({
      state: {
        ...initial,
        members: initial.members.map((entry) => ({ ...entry, hp: 1 })),
      },
    })
    const events = eventsOrThrow(
      game.send({ type: "use", good: contentId("group-potion") })
    )
    const used = events.find((event) => event.type === "used")!
    expect(used.results).toHaveLength(game.state.party.length)
    expect(used.results.every((result) => (result.heal ?? 0) > 0)).toBe(true)
    expect(Bag.count(game.state.bag, contentId("group-potion"))).toBe(1)
    const full = createTestGame({
      state: aState().withItem("group-potion", 1).build(),
    })
    const before = full.state
    expect(
      full.send({ type: "use", good: contentId("group-potion") })
    ).toMatchObject({ code: "NO_EFFECT" })
    expect(full.state).toBe(before)
  })

  it("蘇生の香は倒れた仲間を起こし、浄化の霧は全員の毒と足止めを治す", () => {
    const initial = aState()
      .withItem("revival-incense", 1)
      .withItem("cleansing-mist", 1)
      .withMember("hero", { hp: 0 })
      .build()
    const game = createTestGame({
      state: {
        ...initial,
        members: initial.members.map((entry) => ({
          ...entry,
          status: [
            { kind: "poison", turns: 3 },
            { kind: "bind", turns: 2 },
          ],
        })),
      },
    })
    eventsOrThrow(
      game.send({ type: "use", good: contentId("revival-incense"), member })
    )
    expect(
      game.state.members.find((entry) => entry.id === member)!.hp
    ).toBeGreaterThan(0)
    eventsOrThrow(game.send({ type: "use", good: contentId("cleansing-mist") }))
    expect(game.state.members.every((entry) => entry.status.length === 0)).toBe(
      true
    )
  })

  it.each([
    ["charge-incense", "charge"],
    ["guard-incense", "protect"],
    ["regen-incense", "regen"],
  ] as const)("%s は戦闘で生きている仲間全員に強化を付ける", (slug, status) => {
    const game = createTestGame({
      state: aState()
        .withItem(slug, 1)
        .inBattle({ foes: ["kamokutsu"], order: ["hero", "foe-1"] })
        .build(),
    })
    eventsOrThrow(
      game.send({ type: "act", command: "item", good: contentId(slug) })
    )
    for (const entry of game.state.members.filter((entry) =>
      game.state.party.includes(entry.id)
    ))
      expect(
        entry.status.some((effect) => effect.kind === status),
        entry.id
      ).toBe(true)
    expect(Bag.count(game.state.bag, contentId(slug))).toBe(0)
  })

  it("破裂弾は敵全員に当たり、味方を傷つけない", () => {
    const game = createTestGame({
      state: aState()
        .withItem("burst-bomb", 1)
        .inBattle({
          foes: ["kamokutsu", "kamokutsu"],
          order: ["hero", "foe-1", "foe-2"],
        })
        .build(),
    })
    const before = game.state.members.map((entry) => entry.hp)
    const events = eventsOrThrow(
      game.send({ type: "act", command: "item", good: contentId("burst-bomb") })
    )
    const acted = events.find((event) => event.type === "acted")!
    expect(acted.results.map((result) => result.target.id)).toEqual([
      "foe-1",
      "foe-2",
    ])
    expect(acted.results.every((result) => (result.damage ?? 0) > 0)).toBe(true)
    expect(game.state.members.map((entry) => entry.hp)).toEqual(before)
  })
})
