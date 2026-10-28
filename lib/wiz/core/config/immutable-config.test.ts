import { describe, expect, test } from "vite-plus/test"
import {
  createDefaultDamageConfig,
  DEFAULT_DAMAGE_CONFIG,
} from "@/lib/wiz/core/config/battle/wiz-damage-config"
import { DEFAULT_FLEE_CONFIG } from "@/lib/wiz/core/config/battle/wiz-flee-config"
import {
  createDefaultRewardConfig,
  DEFAULT_REWARD_CONFIG,
} from "@/lib/wiz/core/config/battle/wiz-reward-config"
import { DEFAULT_STATUS_CONVERSION_CONFIG } from "@/lib/wiz/core/config/battle/wiz-status-conversion-config"
import { DEFAULT_EFFECT_CONFIG } from "@/lib/wiz/core/config/battle/wiz-effect-config"
import { DEFAULT_CONVERSATION_CONFIG } from "@/lib/wiz/core/config/conversation/wiz-conversation-config"
import { DEFAULT_EXPLORATION_ACTIONS } from "@/lib/wiz/core/config/exploration/wiz-exploration-config"
import { DEFAULT_EXPLORATION_PROBABILITY_CONFIG } from "@/lib/wiz/core/config/exploration/wiz-exploration-probability-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import { DEFAULT_LEVEL_UP_CONFIG } from "@/lib/wiz/core/config/level-up/wiz-level-up-config"
import { DEFAULT_TIME_CONFIG } from "@/lib/wiz/core/config/time/wiz-time-config"
import type { WizDefaultBattleStatus } from "@/lib/wiz/core/types/wiz-types"

function expectDeeplyFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return
  }

  seen.add(value)
  expect(Object.isFrozen(value)).toBe(true)
  for (const nested of Object.values(value)) {
    expectDeeplyFrozen(nested, seen)
  }
}

describe("immutableConfig", () => {
  test("外部入力を防御コピーし、関数は同一参照のまま保持する", () => {
    const formula = (value: number) => value * 2
    const source = {
      nested: {
        entries: [{ id: "sunny", weight: 50 }],
      },
      formula,
    }

    const owned = immutableConfig(source)

    expect(owned).not.toBe(source)
    expect(owned.nested).not.toBe(source.nested)
    expect(owned.nested.entries).not.toBe(source.nested.entries)
    expect(owned.nested.entries[0]).not.toBe(source.nested.entries[0])
    expect(owned.formula).toBe(formula)
    expect(Object.isFrozen(source)).toBe(false)
    expect(Object.isFrozen(source.nested)).toBe(false)
    expectDeeplyFrozen(owned)

    source.nested.entries[0]!.weight = 99
    source.nested.entries.push({ id: "rainy", weight: 25 })

    expect(owned.nested.entries).toEqual([{ id: "sunny", weight: 50 }])
  })

  test("循環参照も所有分離して凍結する", () => {
    type CyclicConfig = {
      readonly name: string
      self?: CyclicConfig
    }
    const source: CyclicConfig = { name: "loop" }
    source.self = source

    const owned = immutableConfig(source)

    expect(owned).not.toBe(source)
    expect(owned.self).toBe(owned)
    expectDeeplyFrozen(owned)
  })

  test("公開デフォルト設定はすべて深く不変である", () => {
    const defaults: readonly unknown[] = [
      DEFAULT_DAMAGE_CONFIG,
      DEFAULT_FLEE_CONFIG,
      DEFAULT_REWARD_CONFIG,
      DEFAULT_STATUS_CONVERSION_CONFIG,
      DEFAULT_EFFECT_CONFIG,
      DEFAULT_CONVERSATION_CONFIG,
      DEFAULT_EXPLORATION_ACTIONS,
      DEFAULT_EXPLORATION_PROBABILITY_CONFIG,
      DEFAULT_LEVEL_UP_CONFIG,
      DEFAULT_TIME_CONFIG,
    ]

    for (const value of defaults) {
      expectDeeplyFrozen(value)
    }
  })

  test("型付きデフォルト設定ファクトリも不変値を返す", () => {
    const damage = createDefaultDamageConfig<WizDefaultBattleStatus>()
    const reward = createDefaultRewardConfig<{
      readonly custom?: { readonly expReward?: number }
    }>()

    expectDeeplyFrozen(damage)
    expectDeeplyFrozen(reward)
    expect(damage).not.toBe(DEFAULT_DAMAGE_CONFIG)
    expect(reward).not.toBe(DEFAULT_REWARD_CONFIG)
  })

  test("型付きデフォルト報酬は任意のmonster型でも安全にfallbackする", () => {
    const reward = createDefaultRewardConfig<null>()

    expect(reward.expFormula([null])).toBe(10)
    expect(reward.goldFormula([null])).toBe(5)
  })
})
