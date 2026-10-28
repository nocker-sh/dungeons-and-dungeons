import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"

// 精算だけを測るため、取引後の戦闘では確実に全滅する。
const content = aContent()
  .withFoe("kamokutsu", { atk: 9999 })
  .withStation("layer0", "n4", {
    event: "battle",
    foes: [contentId("kamokutsu")],
  })
  .build()

function shop(loot: number, passedMidboss = true) {
  return createTestGame({
    content,
    random: 0,
    state: aState(content)
      .withGold(100 + loot)
      .withMembers({ hp: 1 })
      .inExpedition({
        at: "n3",
        visited: passedMidboss ? ["s", "n8", "n3"] : ["s", "n3"],
        pending: { kind: "discovery" },
        loot: { gold: loot, goods: [] },
      })
      .build(),
  })
}

describe("探索で支払った金貨の精算", () => {
  it("有料の祝福も支払った金貨を戦利品から除き、不正な指定では支払わない", () => {
    const altar = content.layers[0].stations.find(
      (entry) => entry.id === "n2"
    )!.discovery!
    // 祝福の精算経路も、有料の発見を定義できるエンジンの契約を保つ。
    const priced = aContent(content)
      .withStation("layer0", "n2", {
        discovery: {
          ...altar,
          choices: altar.choices.map((entry) =>
            entry.blessings ? { ...entry, cost: 50 } : entry
          ),
        },
      })
      .build()
    const game = createTestGame({
      content: priced,
      state: aState(priced)
        .withGold(180)
        .inExpedition({
          at: "n2",
          visited: ["s", "n2"],
          pending: { kind: "discovery" },
          loot: { gold: 80, goods: [] },
        })
        .build(),
    })
    const choice = game.queries
      .route(game.state)!
      .discovery!.choices.find((entry) => entry.blessings)!
    const before = game.save()
    expect(
      game.send({
        type: "discover",
        choice: choice.id,
        skill: "missing",
        member: game.state.party[0],
      })
    ).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(before)
    eventsOrThrow(
      game.send({
        type: "discover",
        choice: choice.id,
        skill: choice.blessings![0].id,
        member: game.state.party[0],
      })
    )
    expect(game.state.gold).toBe(130)
    expect(game.queries.carried(game.state)!.gold).toBe(30)
    expect(game.restore(game.save())).toBeUndefined()
  })

  it.each([0, 30, 50, 80])(
    "拾った金貨%dGから支払い、帰還手当てと全滅の没収を残額だけで計算する",
    (loot) => {
      const game = shop(loot)
      const choice = game.queries
        .route(game.state)!
        .discovery!.choices.find((entry) => entry.id === "goods")!
      expect(choice.cost).toBe(50)
      const initial = game.save()
      eventsOrThrow(game.send({ type: "discover", choice: "goods" }))
      const remainder = Math.max(0, loot - 50)
      expect(game.state.gold).toBe(100 + loot - 50)
      expect(game.queries.expedition(game.state)!.loot.gold).toBe(remainder)
      expect(game.queries.carried(game.state)!.gold).toBe(remainder)
      const route = game.queries.route(game.state)!
      const bonus = Math.floor(remainder * content.balance.depth.retreatBonus)
      expect(route.carrying.gold).toBe(remainder)
      expect(route.bonus).toBe(bonus)
      expect(route.returnGold).toBe(remainder + bonus)
      expect(route.returnBalance).toBe(100 + loot - 50 + bonus)
      const paid = game.save()
      expect(game.send({ type: "discover", choice: "goods" })).toBeInstanceOf(
        GameCommandError
      )
      expect(game.save()).toEqual(paid)
      expect(game.restore(paid)).toBeUndefined()
      expect(game.queries.route(game.state)).toEqual(route)
      eventsOrThrow(game.send({ type: "acknowledge" }))
      const events = eventsOrThrow(game.send({ type: "retreat" }))
      expect(events).toContainEqual(
        expect.objectContaining({ type: "returned", gold: remainder, bonus })
      )
      expect(game.state.gold).toBe(route.returnBalance)
      expect(game.state.bag).toEqual(paid.snapshot.bag)

      expect(game.restore(paid)).toBeUndefined()
      eventsOrThrow(game.send({ type: "acknowledge" }))
      eventsOrThrow(game.send({ type: "advance", to: "n4" }))
      fightToEnd(game, "guard")
      expect(game.state.phase.type).toBe("town")
      expect(game.state.wipe!.gold).toBe(remainder)
      expect(game.state.gold).toBe(100 - Math.max(0, 50 - loot))
      expect(game.queries.result(game.state)!.gold).toBe(remainder)
      expect(game.restore(game.save())).toBeUndefined()

      expect(game.restore(initial)).toBeUndefined()
      eventsOrThrow(game.send({ type: "discover", choice: "leave" }))
      expect(game.state.gold).toBe(initial.snapshot.gold)
      expect(game.queries.expedition(game.state)!.loot.gold).toBe(loot)
    }
  )

  it("中ボス前の支払いでも持ち帰り表示を減らし、手当ては付かない", () => {
    const game = shop(80, false)
    eventsOrThrow(game.send({ type: "discover", choice: "goods" }))
    expect(game.queries.route(game.state)).toMatchObject({
      carrying: { gold: 30 },
      bonus: 0,
      returnGold: 30,
      returnBalance: 130,
    })
  })

  it("不足で拒否した取引では所持金も戦利品も変えない", () => {
    const game = shop(30)
    const saved = game.save()
    expect(
      game.restore({ ...saved, snapshot: { ...saved.snapshot, gold: 30 } })
    ).toBeUndefined()
    const before = game.save()
    expect(
      (game.send({ type: "discover", choice: "goods" }) as GameCommandError)
        .code
    ).toBe("NO_GOLD")
    expect(game.save()).toEqual(before)
  })
})
