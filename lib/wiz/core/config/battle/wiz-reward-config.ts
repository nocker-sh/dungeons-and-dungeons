import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

/**
 * 戦闘報酬計算設定
 *
 * TMonster はモンスターの型パラメータを表す。
 * 具体的な型は scenes/battle/entities で定義される WizSceneBattleMonster<TStatus, TCustom>。
 */
export type WizExpRewardFormula<TMonster = unknown> = (
  monsters: readonly TMonster[]
) => number

export type WizGoldRewardFormula<TMonster = unknown> = (
  monsters: readonly TMonster[]
) => number

export type WizRewardConfig<TMonster = unknown> = {
  readonly expFormula: WizExpRewardFormula<TMonster>
  readonly goldFormula: WizGoldRewardFormula<TMonster>
}

const readOwnDataProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor !== undefined && "value" in descriptor
    ? descriptor.value
    : undefined
}

const readReward = (
  monster: unknown,
  monsterIndex: number,
  key: "expReward" | "goldReward",
  fallback: number
): number => {
  const custom = readOwnDataProperty(monster, "custom")
  const value = readOwnDataProperty(custom, key)
  if (value === undefined) return fallback
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new WizValueValidationError(
      "reward-calculator",
      `monsters[${monsterIndex}].custom.${key}`,
      value,
      "a finite number, at least 0"
    )
  }
  return value
}

function sumExpReward(monsters: readonly unknown[]): number {
  let total = 0
  for (const [index, monster] of monsters.entries()) {
    total += readReward(monster, index, "expReward", 10)
  }
  return total
}

function sumGoldReward(monsters: readonly unknown[]): number {
  let total = 0
  for (const [index, monster] of monsters.entries()) {
    total += readReward(monster, index, "goldReward", 5)
  }
  return total
}

export const DEFAULT_REWARD_CONFIG: WizRewardConfig = immutableConfig({
  expFormula: sumExpReward,
  goldFormula: sumGoldReward,
})

/**
 * 型パラメータ付きのデフォルト設定を生成
 *
 * ジェネリック型で Calculator を使う場合はこちらを使用
 */
export function createDefaultRewardConfig<
  TMonster,
>(): WizRewardConfig<TMonster> {
  return immutableConfig({
    expFormula: sumExpReward,
    goldFormula: sumGoldReward,
  })
}
