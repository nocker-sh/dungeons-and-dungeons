import { describe, expect, it } from "vite-plus/test"
import {
  WizEffect,
  WizEffectSet,
  type WizEffectStackingRule,
} from "@/lib/wiz/core/domain/values/effect-set"

const poison = WizEffect.define({
  effectId: "poison",
  instanceId: "poison-1",
  lifetime: {
    expiresAtMs: 5_000,
    type: "time",
  },
  maximumStacks: 3,
  payload: {
    damagePerSecond: 2,
  },
  sourceId: "slime-1",
  stacks: 1,
  tags: ["debuff", "poison"],
})

describe("WizEffect and WizEffectSet", () => {
  it("絶対時刻で有効性を計算して期限切れを除去する", () => {
    const effects = WizEffectSet.create([poison])

    expect(effects.active(4_999)).toEqual([poison])
    expect(effects.active(5_000)).toEqual([])
    expect(effects.compact(5_000).effects).toEqual([])
  })

  it("使用回数を不変に消費し、最後の使用で取り除く", () => {
    const shield = WizEffect.define({
      effectId: "shield",
      instanceId: "shield-1",
      lifetime: {
        remaining: 2,
        type: "uses",
      },
      payload: {
        reduction: 5,
      },
      sourceId: "amulet-1",
    })
    const effects = WizEffectSet.create([shield])
    const afterFirstUse = effects.consumeUse("shield-1")
    const afterSecondUse = afterFirstUse.consumeUse("shield-1")

    expect(effects.effects[0]?.lifetime).toEqual({
      remaining: 2,
      type: "uses",
    })
    expect(afterFirstUse.effects[0]?.lifetime).toEqual({
      remaining: 1,
      type: "uses",
    })
    expect(afterSecondUse.effects).toEqual([])
  })

  it("ターン寿命を一括で進め、期限切れだけを取り除く", () => {
    const slow = WizEffect.define({
      effectId: "slow",
      instanceId: "slow-1",
      lifetime: {
        remaining: 2,
        type: "turns",
      },
      payload: { speed: -2 },
      sourceId: "ice-field",
    })
    const permanent = WizEffect.define({
      effectId: "blessing",
      instanceId: "blessing-1",
      lifetime: { type: "permanent" },
      payload: { defense: 1 },
      sourceId: "shrine",
    })
    const effects = WizEffectSet.create([slow, permanent])
    const afterFirstTurn = effects.advanceTurn()
    const afterSecondTurn = afterFirstTurn.advanceTurn()

    expect(effects.effects[0]?.lifetime).toEqual({ remaining: 2, type: "turns" })
    expect(afterFirstTurn.effects[0]?.lifetime).toEqual({
      remaining: 1,
      type: "turns",
    })
    expect(afterSecondTurn.effects).toEqual([permanent])
  })

  it("作品固有のstack ruleを適用する", () => {
    const incoming = WizEffect.define({
      ...poison.toProperties(),
      instanceId: "poison-2",
      sourceId: "slime-2",
    })
    const stack: WizEffectStackingRule<typeof poison | typeof incoming> = {
      combine: (current) => [
        current[0].withStacks(Math.min(current[0].maximumStacks, current[0].stacks + 1)),
      ],
    }
    const effects = WizEffectSet.create([poison]).apply(incoming, stack)

    expect(effects.effects).toHaveLength(1)
    expect(effects.effects[0]?.stacks).toBe(2)
  })
})
