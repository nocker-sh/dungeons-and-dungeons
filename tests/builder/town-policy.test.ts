import { describe, expect, it, vi } from "vite-plus/test"
import { Session } from "@/builder/lib/session"
import { townDay } from "@/builder/lib/policy/town"
import { Bag } from "@/lib/wiz/rules/bag"

describe("街の自動補給", () => {
  it.each([[1, 3], [1, 1], [4], [1, 4]].map((stacks) => ({ stacks })))(
    "分かれた在庫 $stacks を合計し、不足分だけを買う",
    ({ stacks }) => {
      const session = Session.create([], 42)
      const potion = session.id("potion", "goods")
      const total = stacks.reduce((sum, count) => sum + count, 0)
      const price = session.catalog.good(potion)!.price!
      session.patch((state) => {
        state.gold = 500
        state.bag = stacks.map((count) => ({ good: potion, count }))
      })
      // 保存からの再開でも、複数行の在庫は有効。
      const restored = new Session(session.built, 42, session.dump())
      const merged = new Session(session.built, 42, session.dump())
      merged.patch((state) => {
        state.bag = [{ good: potion, count: total }]
      })
      const options = { potions: 4, upgrade: false, summon: false, shop: false }
      const expected = townDay(merged, options)
      const actual = townDay(restored, options)
      const need = Math.max(0, 4 - total)
      expect(actual.spentGold).toBe(need * price)
      expect(Bag.count(restored.state.bag, potion)).toBe(total + need)
      expect(actual).toEqual(expected)
      expect(restored.state.gold).toBe(merged.state.gold)
      expect(restored.state.provisions).toEqual(merged.state.provisions)
      expect(restored.state.provisions).toEqual([
        { good: potion, count: Math.max(4, total) },
      ])
      expect(restored.state.members).toEqual(merged.state.members)
      expect(restored.state.gear).toEqual(merged.state.gear)
      expect(restored.queries.problems(restored.state)).toEqual([])
    }
  )
})

describe("街の自動プレイの強化費用", () => {
  it.each([
    { gold: 100000, materials: 0, upgrade: true },
    { gold: 100000, materials: 100, upgrade: true },
    { gold: 0, materials: 0, upgrade: true },
    { gold: 100000, materials: 0, upgrade: false },
  ])("素材購入も実際の支出に含める: %j", (setup) => {
    const session = Session.create([], 42)
    const materialIds = new Set(
      session.catalog.data.smithy!.upgrades.flatMap((step) =>
        step.materials.map((item) => item.good)
      )
    )
    session.patch((state) => {
      state.gold = setup.gold
      state.bag = [...materialIds].flatMap((good) =>
        setup.materials ? [{ good, count: setup.materials }] : []
      )
    })
    const beforeGold = session.state.gold
    const send = session.send.bind(session)
    let materialsGold = 0
    let upgradesGold = 0
    let lodgingGold = 0
    const capture = vi.spyOn(session, "send").mockImplementation((action) => {
      const before = session.state.gold
      const events = send(action)
      const paid = before - session.state.gold
      if (action.type === "buy" && materialIds.has(action.good))
        materialsGold += paid
      if (action.type === "upgrade") upgradesGold += paid
      if (action.type === "rest") lodgingGold += paid
      return events
    })
    try {
      const result = townDay(session, {
        potions: 0,
        upgrade: setup.upgrade,
        summon: false,
        shop: false,
      })
      if (setup.gold && setup.upgrade) {
        expect(upgradesGold).toBeGreaterThan(0)
        if (setup.materials) expect(materialsGold).toBe(0)
        else expect(materialsGold).toBeGreaterThan(0)
      } else {
        expect(materialsGold).toBe(0)
        expect(upgradesGold).toBe(0)
      }
      expect(result.spentGold).toBe(materialsGold + upgradesGold)
      expect(beforeGold - session.state.gold).toBe(
        result.spentGold + lodgingGold + result.repairGold
      )
      expect(session.queries.problems(session.state)).toEqual([])
    } finally {
      capture.mockRestore()
    }
  })
})
