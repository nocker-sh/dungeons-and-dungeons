import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

const createReward = () =>
  new WizEngineBattleReward({
    experience: 100,
    gold: 50,
    custom: {},
  })

describe("WizEngineBattleReward", () => {
  it("IDと数量だけで不変な報酬を作成する", () => {
    const droppedItems = [{ itemId: "herb", quantity: 2 }]
    const custom = { tiers: [{ name: "rare" }] }
    const reward = new WizEngineBattleReward({
      experience: 100,
      gold: 50,
      droppedItems,
      custom,
    })

    droppedItems[0]!.quantity = 99
    custom.tiers[0]!.name = "changed"

    expect(reward.experience).toBe(100)
    expect(reward.gold).toBe(50)
    expect(reward.droppedItems).toEqual([{ itemId: "herb", quantity: 2 }])
    expect(reward.custom).toEqual({ tiers: [{ name: "rare" }] })
    expect(Object.isFrozen(reward)).toBe(true)
    expect(Object.isFrozen(reward.droppedItems)).toBe(true)
    expect(Object.isFrozen(reward.droppedItems[0])).toBe(true)
    expect(Object.isFrozen(reward.custom.tiers)).toBe(true)
    expectTypeOf(reward.custom).toEqualTypeOf<{
      readonly tiers: readonly { readonly name: string }[]
    }>()
  })

  it("純粋なwith操作で値を更新する", () => {
    const reward = createReward()
    const updated = reward
      .withExperience(200)
      .withGold(80)
      .withDroppedItems([{ itemId: "gem", quantity: 1 }])
      .withCustom({ rare: true })

    expect(updated.toProperties()).toEqual({
      experience: 200,
      gold: 80,
      droppedItems: [{ itemId: "gem", quantity: 1 }],
      custom: { rare: true },
    })
    expect(reward.toProperties()).toEqual({
      experience: 100,
      gold: 50,
      droppedItems: [],
      custom: {},
    })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "不正なexperience %s を拒否する",
    (experience) => {
      expect(
        () =>
          new WizEngineBattleReward({
            experience,
            gold: 0,
            custom: {},
          }),
      ).toThrow(WizValueValidationError)
    },
  )

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, -1])("不正なgold %s を拒否する", (gold) => {
    expect(
      () =>
        new WizEngineBattleReward({
          experience: 0,
          gold,
          custom: {},
        }),
    ).toThrow(WizValueValidationError)
  })

  it.each([
    [{ itemId: "", quantity: 1 }, "droppedItems[0].itemId"],
    [{ itemId: " herb ", quantity: 1 }, "droppedItems[0].itemId"],
    [{ itemId: "herb", quantity: 0 }, "droppedItems[0].quantity"],
    [{ itemId: "herb", quantity: 1.5 }, "droppedItems[0].quantity"],
    [{ itemId: "herb", quantity: Number.NaN }, "droppedItems[0].quantity"],
  ] as const)("不正なdropを拒否する", (drop, expectedPath) => {
    let caught: unknown
    try {
      new WizEngineBattleReward({
        experience: 0,
        gold: 0,
        droppedItems: [drop],
        custom: {},
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(WizValueValidationError)
    expect(caught).toMatchObject({
      path: expectedPath,
      source: "battle-reward",
    })
  })

  it("prototypeだけを偽装したrewardから真正なrewardを生成できない", () => {
    const forged = Object.create(WizEngineBattleReward.prototype) as WizEngineBattleReward

    expect(() => forged.withExperience(1)).toThrow(
      "Battle reward calculator must return an authentic WizEngineBattleReward",
    )
    expect(() => forged.withGold(1)).toThrow(
      "Battle reward calculator must return an authentic WizEngineBattleReward",
    )
    expect(() => forged.withDroppedItems([])).toThrow(
      "Battle reward calculator must return an authentic WizEngineBattleReward",
    )
    expect(() => forged.withCustom({})).toThrow(
      "Battle reward calculator must return an authentic WizEngineBattleReward",
    )
    expect(() => forged.toProperties()).toThrow(
      "Battle reward calculator must return an authentic WizEngineBattleReward",
    )
  })

  it("classとprototypeを固定する", () => {
    expect(Object.isFrozen(WizEngineBattleReward)).toBe(true)
    expect(Object.isFrozen(WizEngineBattleReward.prototype)).toBe(true)
  })
})
