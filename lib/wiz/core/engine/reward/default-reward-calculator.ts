import {
  createDefaultRewardConfig,
  type WizRewardConfig,
} from "@/lib/wiz/core/config/battle/wiz-reward-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import {
  WizEngineBattleReward,
  type WizEngineBattleDroppedItem,
} from "@/lib/wiz/core/engine/reward/battle-reward"
import { assertArrayValue } from "@/lib/wiz/core/assert-array-value"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"

export type WizEngineBattleRewardParameters<
  TStatus = unknown,
  TCustom = unknown,
> = {
  readonly enemies: WizBattleEnemyParty<TStatus, TCustom>
}

/**
 * 戦闘報酬計算を差し替えるstructural port。
 *
 * 経験値・ゴールド・ドロップアイテムを敵パーティから算出する。
 * 既定実装は {@link WizEngineBattleDefaultRewardCalculator}。
 * `WizRewardConfig` で式を差し替えられるなら preset.reward で十分。
 * カスタム実装を渡す場合は `WizSceneBattleService.rewardCalculator` 経由で注入する。
 */
export type WizEngineBattleRewardCalculator<
  TStatus = unknown,
  TBattleCustom = unknown,
  TRewardCustom = undefined,
> = Readonly<{
  readonly calculate: (
    parameters: WizEngineBattleRewardParameters<TStatus, TBattleCustom>
  ) => WizEngineBattleReward<TRewardCustom>
}>

type MonsterWithDrops = {
  readonly custom?: {
    readonly drops?: readonly {
      readonly itemId: string
      readonly chance: number
    }[]
  }
}

function calculateDroppedItems(
  monsters: readonly unknown[],
  dice: WizDice
): WizEngineBattleDroppedItem[] {
  const dropMap = new Map<string, number>()
  for (const [monsterIndex, monster] of (
    monsters as readonly MonsterWithDrops[]
  ).entries()) {
    const drops = monster.custom?.drops
    if (drops === undefined) continue
    const dropsPath = `enemies[${monsterIndex}].custom.drops`
    assertArrayValue("reward-calculator", dropsPath, drops)
    for (const [dropIndex, drop] of drops.entries()) {
      const dropPath = `${dropsPath}[${dropIndex}]`
      assertRecordValue("reward-calculator", dropPath, drop)
      assertTrimmedNonEmptyStringValue(
        "reward-calculator",
        `${dropPath}.itemId`,
        drop.itemId
      )
      assertFiniteNumberValue(
        "reward-calculator",
        `${dropPath}.chance`,
        drop.chance,
        {
          maximum: 100,
          minimum: 0,
        }
      )
      if (dice.chance(drop.chance)) {
        dropMap.set(drop.itemId, (dropMap.get(drop.itemId) ?? 0) + 1)
      }
    }
  }
  const result: WizEngineBattleDroppedItem[] = []
  for (const [itemId, quantity] of dropMap) {
    result.push({ itemId, quantity })
  }
  return result
}

export type WizEngineBattleDefaultRewardCalculatorDefinition<
  TStatus = unknown,
  TCustom = unknown,
> = {
  readonly config?: WizRewardConfig<WizBattleMonster<TStatus, TCustom>>
  readonly dice?: WizDice
}

export class WizEngineBattleDefaultRewardCalculator<
  TStatus = unknown,
  TCustom = unknown,
> implements WizEngineBattleRewardCalculator<TStatus, TCustom, undefined> {
  private readonly config: WizRewardConfig<WizBattleMonster<TStatus, TCustom>>
  private readonly dice: WizDice

  constructor(
    properties: WizEngineBattleDefaultRewardCalculatorDefinition<
      TStatus,
      TCustom
    > = {}
  ) {
    this.config = immutableConfig(
      properties.config ?? createDefaultRewardConfig()
    )
    this.dice = properties.dice ?? new WizDice()
    Object.freeze(this)
  }

  readonly calculate = (
    parameters: WizEngineBattleRewardParameters<TStatus, TCustom>
  ): WizEngineBattleReward<undefined> => {
    const monsters = Object.freeze(parameters.enemies.getAllMonsters())
    const totalExperience = this.config.expFormula(monsters)
    assertFiniteNumberValue(
      "reward-calculator",
      "expFormula",
      totalExperience,
      {
        minimum: 0,
      }
    )
    const totalGold = this.config.goldFormula(monsters)
    assertFiniteNumberValue("reward-calculator", "goldFormula", totalGold, {
      minimum: 0,
    })
    const droppedItems = calculateDroppedItems(monsters, this.dice)

    return new WizEngineBattleReward({
      experience: totalExperience,
      gold: totalGold,
      droppedItems,
      custom: undefined,
    })
  }
}

Object.freeze(WizEngineBattleDefaultRewardCalculator.prototype)
Object.freeze(WizEngineBattleDefaultRewardCalculator)
