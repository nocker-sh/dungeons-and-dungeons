import { describe, expect, it } from "vite-plus/test"
import { Bag, baseSellPrice } from "@/lib/wiz/rules"
import { contentId, realContent } from "@/lib/wiz/testing"
import { createTestPlay, eventsOrThrow, startedState } from "@/lib/wiz/testing"
import { GameCommandError, type GameState } from "@/lib/wiz"

describe("袋の足し引き", () => {
  const bag = Object.freeze([
    Object.freeze({ good: contentId("potion"), count: 2 }),
    Object.freeze({ good: contentId("bone"), count: 1 }),
  ])

  it("足しても引いても元の袋を書き換えない", () => {
    const before = JSON.stringify(bag)
    Bag.add(bag, [{ good: contentId("potion"), count: 3 }])
    Bag.remove(bag, contentId("potion"), 2)
    Bag.pay(bag, [{ good: contentId("bone"), count: 1 }])
    expect(JSON.stringify(bag)).toBe(before)
  })

  it("同じ品物は一つの束にまとまり、数が0になった束は消える", () => {
    expect(Bag.add(bag, [{ good: contentId("potion"), count: 3 }])).toEqual([
      { good: contentId("potion"), count: 5 },
      { good: contentId("bone"), count: 1 },
    ])
    expect(Bag.remove(bag, contentId("bone"), 1)).toEqual([
      { good: contentId("potion"), count: 2 },
    ])
    expect(Bag.add([], [{ good: contentId("junk"), count: 1 }])).toEqual([
      { good: contentId("junk"), count: 1 },
    ])
  })

  it("足りなければ引かずに null を返す（部分的に減らさない）", () => {
    expect(Bag.remove(bag, contentId("potion"), 3)).toBe(null)
    expect(Bag.remove(bag, "いない品物")).toBe(null)
    expect(Bag.remove([], contentId("potion"))).toBe(null)
    expect(
      Bag.pay(bag, [
        { good: contentId("potion"), count: 2 },
        { good: contentId("bone"), count: 2 },
      ])
    ).toBe(null)
  })

  it("まとめて払うときは同じ品物が二回並んでも合計で見る", () => {
    expect(
      Bag.pay(bag, [
        { good: contentId("potion"), count: 1 },
        { good: contentId("potion"), count: 1 },
      ])
    ).toEqual([{ good: contentId("bone"), count: 1 }])
    expect(
      Bag.pay(bag, [
        { good: contentId("potion"), count: 2 },
        { good: contentId("potion"), count: 1 },
      ])
    ).toBe(null)
  })

  it("同じ品物が二つの束に分かれていても数を取り違えない", () => {
    const split = [
      { good: contentId("potion"), count: 1 },
      { good: contentId("bone"), count: 1 },
      { good: contentId("potion"), count: 2 },
    ]
    expect(Bag.count(split, contentId("potion"))).toBe(3)
    expect(Bag.remove(split, contentId("potion"), 3)).toEqual([
      { good: contentId("bone"), count: 1 },
    ])
    expect(Bag.remove(split, contentId("potion"), 4)).toBe(null)
    expect(Bag.pay(split, [{ good: contentId("potion"), count: 2 }])).toEqual([
      { good: contentId("bone"), count: 1 },
      { good: contentId("potion"), count: 1 },
    ])
  })

  it("[feature:W024] 束が分かれた保存を読み込んでも、素材はその数だけ使える", () => {
    const { game, definition } = createTestPlay()
    const base = startedState(definition)
    const split: GameState = {
      ...base,
      gold: 100,
      bag: [
        { good: contentId("cinder"), count: 1 },
        { good: contentId("bone"), count: 2 },
        { good: contentId("cinder"), count: 1 },
      ],
    }
    const save = {
      ...(JSON.parse(JSON.stringify(game.save())) as object),
      snapshot: JSON.parse(JSON.stringify(split)),
    }
    expect(game.restore(save)).toBeUndefined()
    expect(game.queries.junk(game.state).count).toBe(0)
    eventsOrThrow(game.send({ type: "craft", recipe: contentId("craft-axe") }))
    // 束が分かれていても、もう一つの燃えカスで短剣を作れる
    expect(
      game.send({ type: "craft", recipe: contentId("craft-dagger") })
    ).not.toBeInstanceOf(GameCommandError)
    expect(Bag.count(game.state.bag, contentId("cinder"))).toBe(0)
  })
})

describe("レア度をかける前の売値", () => {
  it("売値があればそれ、なければ値段の半分（切り捨て・下限1）", () => {
    expect(baseSellPrice({ sell: 18, price: 100 })).toBe(18)
    expect(baseSellPrice({ price: 55 })).toBe(27)
    expect(baseSellPrice({ price: 1 })).toBe(1)
    expect(baseSellPrice({ price: 0 })).toBe(1)
    expect(baseSellPrice({})).toBe(1)
    expect(baseSellPrice({ sell: 0 })).toBe(0)
  })

  it("[feature:W009] 店で買ってすぐ売ると、どのレア度でも得をしない", () => {
    const sell = realContent().balance.weapon.rarity.sell
    for (const shop of realContent().shops)
      for (const id of shop.goods) {
        const good = realContent().goods.find((entry) => entry.id === id)!
        const price = good.price!
        for (const rarity of ["N", "R", "SR"] as const) {
          const back = Math.max(
            1,
            Math.round(baseSellPrice(good) * sell[rarity])
          )
          expect(back, `${id} ${rarity}`).toBeLessThanOrEqual(price)
        }
      }
  })
})
