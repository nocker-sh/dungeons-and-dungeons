import { describe, expect, it } from "vite-plus/test"
import {
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
  goodBySlug,
  sequentialIds,
} from "@/lib/wiz/testing"

describe("持つと強くなる仲間（upgrades）", () => {
  it("買った武器で攻撃力が上がる仲間だけを、上がり幅の大きい順に出す", () => {
    const game = createTestGame({
      state: aState().withGold(5000).build(),
      ids: sequentialIds("bought"),
    })
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: goodBySlug("greatsword").id,
      })
    )
    const gear = game.state.gear.at(-1)!
    const list = game.queries.upgrades(game.state, gear.id)
    expect(list.length).toBeGreaterThan(0)
    for (const entry of list) expect(entry.after).toBeGreaterThan(entry.before)
    const gains = list.map((entry) => entry.after - entry.before)
    expect([...gains].sort((left, right) => right - left)).toEqual(gains)
    // 着けた本人には出さず、着けたあとの攻撃力は見込みと一致する
    const best = list[0]
    eventsOrThrow(
      game.send({ type: "equip", gear: gear.id, member: best.member })
    )
    const member = game.state.members.find((entry) => entry.id === best.member)!
    expect(game.queries.weapon(game.state, member)?.attack).toBe(best.after)
    expect(
      game.queries
        .upgrades(game.state, gear.id)
        .some((entry) => entry.member === best.member)
    ).toBe(false)
  })

  it("武器でない個体や知らない id では空", () => {
    const game = createTestGame({ state: aState().build() })
    expect(game.queries.upgrades(game.state, "nothing")).toEqual([])
  })

  it("掘り出し物は到達した層より先の段の品だけ", () => {
    const game = createTestGame({ state: aState().withReached(0).build() })
    expect(game.queries.bargain(game.state, goodBySlug("bone-gun").id)).toBe(
      true
    )
    expect(game.queries.bargain(game.state, goodBySlug("gun").id)).toBe(false)
  })

  it("店の武器を買う前に、持つと強くなる仲間が分かり、買って着けると見込みどおり", () => {
    const game = createTestGame({
      state: aState().withGold(5000).build(),
      ids: sequentialIds("bought"),
    })
    const good = goodBySlug("greatsword").id
    const best = game.queries.upgradesForGood(game.state, good)[0]
    expect(best).toBeDefined()
    eventsOrThrow(game.send({ type: "buy", shop: contentId("armory"), good }))
    const gear = game.state.gear.at(-1)!
    eventsOrThrow(
      game.send({ type: "equip", gear: gear.id, member: best.member })
    )
    const member = game.state.members.find((entry) => entry.id === best.member)!
    expect(game.queries.weapon(game.state, member)?.attack).toBe(best.after)
  })

  it("おまかせの割り振りは一人に一つ・一つの武器は一人だけで、全部着けると見込みどおり強くなる", () => {
    const game = createTestGame({
      state: aState().withGold(5000).build(),
      ids: sequentialIds("bought"),
    })
    for (const slug of ["greatsword", "gun", "sword", "greatsword"])
      eventsOrThrow(
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: goodBySlug(slug).id,
        })
      )
    const plan = game.queries.bestWeapons(game.state)
    expect(plan.length).toBeGreaterThan(0)
    expect(new Set(plan.map((entry) => entry.member)).size).toBe(plan.length)
    expect(new Set(plan.map((entry) => entry.gear)).size).toBe(plan.length)
    for (const entry of plan) {
      expect(entry.after).toBeGreaterThan(entry.before)
      eventsOrThrow(
        game.send({ type: "equip", gear: entry.gear, member: entry.member })
      )
    }
    for (const entry of plan) {
      const member = game.state.members.find(
        (item) => item.id === entry.member
      )!
      expect(game.queries.weapon(game.state, member)?.attack).toBe(entry.after)
    }
  })
})
