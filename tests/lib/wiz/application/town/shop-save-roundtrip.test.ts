import { expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const definition = new GameDefinition(realContent())
const initial = startedState(definition)
const sales = definition.catalog.data.shops.flatMap((shop) =>
  shop.goods.map((id) => ({
    shop: shop.id,
    good: definition.catalog.good(id)!,
  }))
)

it.each(sales)(
  "本番の店 $shop の $good.name は表示・購入・保存再開・売却が一致する",
  (sale) => {
    const good = sale.good
    const price = good.price!
    expect(price).toBeGreaterThan(0)
    const action = { type: "buy" as const, shop: sale.shop, good: good.id }
    // 到達層と所持金は境界を確かめる初期条件。探索でその層へ到達した検査とは分ける。
    const ready = {
      ...initial,
      reached: good.unlock ?? 0,
      gold: price,
      bag: [],
    }
    if (good.unlock) {
      const locked = definition.create(testEnvironment(), {
        ...ready,
        reached: good.unlock - 1,
      })
      expect(
        locked.queries
          .shop(locked.state, sale.shop)!
          .goods.some((entry) => entry.id === good.id)
      ).toBe(false)
      const saved = locked.save()
      expect(locked.send(action)).toMatchObject({ code: "LOCKED" })
      expect(locked.save()).toEqual(saved)
    }
    const short = definition.create(testEnvironment(), {
      ...ready,
      gold: price - 1,
    })
    expect(
      short.queries
        .shop(short.state, sale.shop)!
        .goods.find((entry) => entry.id === good.id)
    ).toMatchObject({ price, affordable: false })
    const refused = short.save()
    expect(short.send(action)).toMatchObject({ code: "NO_GOLD" })
    expect(short.save()).toEqual(refused)

    const game = definition.create(testEnvironment(), ready)
    const row = game.queries
      .shop(game.state, sale.shop)!
      .goods.find((entry) => entry.id === good.id)!
    expect(row).toMatchObject({ price, affordable: true })
    const before = game.state
    expect(eventsOrThrow(game.send(action))).toEqual([
      { type: "bought", good: good.id, price },
    ])
    expect(game.state.gold).toBe(0)
    const boughtGear = game.state.gear.find(
      (entry) => !before.gear.some((old) => old.id === entry.id)
    )
    if (good.stones) {
      expect(game.state).toEqual({
        ...before,
        gold: 0,
        stones: before.stones + good.stones,
      })
    } else if (good.kind === "weapon" || good.kind === "armor") {
      expect(boughtGear).toMatchObject({
        good: good.id,
        owner: null,
        plus: 0,
        progress: 0,
        wear: 0,
      })
      expect(game.state).toEqual({
        ...before,
        gold: 0,
        gear: [...before.gear, boughtGear],
      })
    } else {
      expect(game.state).toEqual({
        ...before,
        gold: 0,
        bag: [{ good: good.id, count: 1 }],
      })
    }
    const paid = game.save()
    expect(game.send(action)).toMatchObject({ code: "NO_GOLD" })
    expect(game.save()).toEqual(paid)
    const resumed = definition.create(testEnvironment())
    expect(resumed.restore(JSON.parse(JSON.stringify(paid)))).toBeUndefined()
    expect(resumed.save()).toEqual(paid)
    expect(
      resumed.queries
        .shop(resumed.state, sale.shop)!
        .goods.find((entry) => entry.id === good.id)?.own
    ).toBe(row.own + (good.stones ?? 1))
    if (good.stones) return

    const sell = boughtGear ? { gear: boughtGear.id } : { good: good.id }
    const sellRow = resumed.queries
      .sellables(resumed.state)
      .find((entry) =>
        boughtGear
          ? entry.sell.gear === boughtGear.id
          : entry.sell.good === good.id
      )
    if (good.sellable === false) {
      expect(sellRow).toBeUndefined()
      expect(resumed.send({ type: "sell", ...sell })).toMatchObject({
        code: "UNAVAILABLE",
      })
      expect(resumed.save()).toEqual(paid)
      return
    }
    expect(sellRow).toBeDefined()
    expect(eventsOrThrow(resumed.send({ type: "sell", ...sell }))).toEqual([
      { type: "sold", good: good.id, price: sellRow!.price },
    ])
    expect(resumed.state).toEqual({ ...before, gold: sellRow!.price })
    const sold = resumed.save()
    expect(resumed.restore(JSON.parse(JSON.stringify(sold)))).toBeUndefined()
    expect(resumed.send({ type: "sell", ...sell })).toMatchObject({
      code: "NOT_OWNED",
    })
    expect(resumed.save()).toEqual(sold)
  }
)
