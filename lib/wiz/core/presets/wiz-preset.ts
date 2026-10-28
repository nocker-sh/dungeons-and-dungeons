import type { WizDamageConfig } from "@/lib/wiz/core/config/battle/wiz-damage-config"
import { DEFAULT_DAMAGE_CONFIG } from "@/lib/wiz/core/config/battle/wiz-damage-config"
import type { WizFleeConfig } from "@/lib/wiz/core/config/battle/wiz-flee-config"
import { DEFAULT_FLEE_CONFIG } from "@/lib/wiz/core/config/battle/wiz-flee-config"
import type { WizRewardConfig } from "@/lib/wiz/core/config/battle/wiz-reward-config"
import { DEFAULT_REWARD_CONFIG } from "@/lib/wiz/core/config/battle/wiz-reward-config"
import {
  DEFAULT_EFFECT_CONFIG,
  type WizEffectConfig,
} from "@/lib/wiz/core/config/battle/wiz-effect-config"
import type {
  WizStatusConversionConfig,
  WizStatusConversionOverrides,
  WizStatusConversionPatch,
} from "@/lib/wiz/core/config/battle/wiz-status-conversion-config"
import { DEFAULT_STATUS_CONVERSION_CONFIG } from "@/lib/wiz/core/config/battle/wiz-status-conversion-config"
import type { WizConversationConfig } from "@/lib/wiz/core/config/conversation/wiz-conversation-config"
import { DEFAULT_CONVERSATION_CONFIG } from "@/lib/wiz/core/config/conversation/wiz-conversation-config"
import {
  DEFAULT_EXPLORATION_PROBABILITY_CONFIG,
  type WizExplorationProbabilityConfig,
} from "@/lib/wiz/core/config/exploration/wiz-exploration-probability-config"
import type { WizLevelUpConfig } from "@/lib/wiz/core/config/level-up/wiz-level-up-config"
import { DEFAULT_LEVEL_UP_CONFIG } from "@/lib/wiz/core/config/level-up/wiz-level-up-config"
import {
  DEFAULT_TIME_CONFIG,
  type WizTimeConfig,
} from "@/lib/wiz/core/config/time/wiz-time-config"
import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import { assertValidWizPreset } from "@/lib/wiz/core/presets/assert-valid-wiz-preset"
import type {
  WizBattleMonsterCustom,
  WizBattleStatusCustom,
  WizBattleStatusView,
  WizDefaultTypes,
  WizTypes,
} from "@/lib/wiz/core/types/wiz-types"

const wizPresetConstructionToken = Symbol("WizPresetValue.constructor")
const authenticWizPresetValues = new WeakSet<object>()

const assertWizPresetConstructionToken = (token: symbol): void => {
  if (token !== wizPresetConstructionToken) {
    throw new TypeError(
      "WizPresetValue must be created with WizPresetValue.create() or from()"
    )
  }
}

const assertAuthenticWizPresetValue = (preset: object): void => {
  if (!authenticWizPresetValues.has(preset)) {
    throw new TypeError(
      "WizPresetValue instance was not created by its public factories"
    )
  }
}

/**
 * `WizRootReducer` が構成する設定を集約したプリセット
 *
 * @template T - 型セット (WizTypes を拡張)
 */
export type WizPreset<T extends WizTypes = WizDefaultTypes> = {
  readonly damage: WizDamageConfig<
    WizBattleStatusView<WizBattleStatusCustom<T["BattleStatus"]>>
  >
  readonly reward: WizRewardConfig<
    WizBattleMonster<
      WizBattleStatusCustom<T["BattleStatus"]>,
      WizBattleMonsterCustom<T>
    >
  >
  readonly flee: WizFleeConfig
  readonly effect: WizEffectConfig
  readonly statusConversion: WizStatusConversionConfig<T["BattleStatus"]>
  readonly levelUp: WizLevelUpConfig
  readonly conversation: WizConversationConfig
  readonly exploration: WizExplorationProbabilityConfig
  readonly time: WizTimeConfig
}

export type WizPresetTimeOverrides = {
  readonly seasonEffects?: Partial<WizTimeConfig["seasonEffects"]>
  readonly timeEffects?: Partial<WizTimeConfig["timeEffects"]>
  readonly weatherEffects?: Partial<WizTimeConfig["weatherEffects"]>
  readonly weatherWeights?: Partial<WizTimeConfig["weatherWeights"]>
}

export type WizPresetOverrides<T extends WizTypes = WizDefaultTypes> = Partial<{
  damage: Partial<
    WizDamageConfig<
      WizBattleStatusView<WizBattleStatusCustom<T["BattleStatus"]>>
    >
  >
  reward: Partial<
    WizRewardConfig<
      WizBattleMonster<
        WizBattleStatusCustom<T["BattleStatus"]>,
        WizBattleMonsterCustom<T>
      >
    >
  >
  flee: Partial<WizFleeConfig>
  effect: Partial<WizEffectConfig>
  statusConversion: WizStatusConversionPatch<T["BattleStatus"]>
  levelUp: Partial<WizLevelUpConfig>
  conversation: Partial<WizConversationConfig>
  exploration: Partial<WizExplorationProbabilityConfig>
  time: WizPresetTimeOverrides
}>

export type WizPresetCreateOverrides<T extends WizTypes = WizDefaultTypes> = [
  keyof WizBattleStatusCustom<T["BattleStatus"]>,
] extends [never]
  ? WizPresetOverrides<T>
  : Omit<WizPresetOverrides<T>, "statusConversion"> & {
      readonly statusConversion: WizStatusConversionOverrides<T["BattleStatus"]>
    }

type WizPresetCreateArguments<T extends WizTypes> = [
  keyof WizBattleStatusCustom<T["BattleStatus"]>,
] extends [never]
  ? [overrides?: WizPresetCreateOverrides<T>]
  : [overrides: WizPresetCreateOverrides<T>]

function mergePreset<T extends WizTypes>(
  base: WizPreset<T>,
  overrides: WizPresetOverrides<T>
): WizPreset<T> {
  return {
    damage: overrides.damage
      ? { ...base.damage, ...overrides.damage }
      : base.damage,
    reward: overrides.reward
      ? { ...base.reward, ...overrides.reward }
      : base.reward,
    flee: overrides.flee ? { ...base.flee, ...overrides.flee } : base.flee,
    effect: overrides.effect
      ? { ...base.effect, ...overrides.effect }
      : base.effect,
    statusConversion: (overrides.statusConversion
      ? { ...base.statusConversion, ...overrides.statusConversion }
      : base.statusConversion) as WizStatusConversionConfig<T["BattleStatus"]>,
    levelUp: overrides.levelUp
      ? { ...base.levelUp, ...overrides.levelUp }
      : base.levelUp,
    conversation: overrides.conversation
      ? { ...base.conversation, ...overrides.conversation }
      : base.conversation,
    exploration: overrides.exploration
      ? { ...base.exploration, ...overrides.exploration }
      : base.exploration,
    time: overrides.time
      ? {
          seasonEffects: overrides.time.seasonEffects
            ? { ...base.time.seasonEffects, ...overrides.time.seasonEffects }
            : base.time.seasonEffects,
          timeEffects: overrides.time.timeEffects
            ? { ...base.time.timeEffects, ...overrides.time.timeEffects }
            : base.time.timeEffects,
          weatherEffects: overrides.time.weatherEffects
            ? { ...base.time.weatherEffects, ...overrides.time.weatherEffects }
            : base.time.weatherEffects,
          weatherWeights: overrides.time.weatherWeights
            ? { ...base.time.weatherWeights, ...overrides.time.weatherWeights }
            : base.time.weatherWeights,
        }
      : base.time,
  }
}

/**
 * Root構成用configを保持するimmutable value。
 *
 * `create()` でデフォルトから構築し、`with()` で一部だけ変更した新しい値を返す。
 */
export class WizPresetValue<
  T extends WizTypes = WizDefaultTypes,
> implements WizPreset<T> {
  declare private readonly presetType: T
  declare private readonly wizPresetValueType: true
  readonly damage: WizDamageConfig<
    WizBattleStatusView<WizBattleStatusCustom<T["BattleStatus"]>>
  >
  readonly reward: WizRewardConfig<
    WizBattleMonster<
      WizBattleStatusCustom<T["BattleStatus"]>,
      WizBattleMonsterCustom<T>
    >
  >
  readonly flee: WizFleeConfig
  readonly effect: WizEffectConfig
  readonly statusConversion: WizStatusConversionConfig<T["BattleStatus"]>
  readonly levelUp: WizLevelUpConfig
  readonly conversation: WizConversationConfig
  readonly exploration: WizExplorationProbabilityConfig
  readonly time: WizTimeConfig

  private constructor(token: symbol, properties: WizPreset<T>) {
    assertWizPresetConstructionToken(token)
    assertValidWizPreset(properties)
    const immutable = immutableConfig(properties)
    this.damage = immutable.damage
    this.reward = immutable.reward
    this.flee = immutable.flee
    this.effect = immutable.effect
    this.statusConversion = immutable.statusConversion
    this.levelUp = immutable.levelUp
    this.conversation = immutable.conversation
    this.exploration = immutable.exploration
    this.time = immutable.time
    authenticWizPresetValues.add(this)
    Object.freeze(this)
  }

  static create<T extends WizTypes = WizDefaultTypes>(
    ...args: WizPresetCreateArguments<T>
  ): WizPresetValue<T> {
    const base = {
      damage: DEFAULT_DAMAGE_CONFIG,
      reward: DEFAULT_REWARD_CONFIG,
      flee: DEFAULT_FLEE_CONFIG,
      effect: DEFAULT_EFFECT_CONFIG,
      statusConversion: DEFAULT_STATUS_CONVERSION_CONFIG,
      levelUp: DEFAULT_LEVEL_UP_CONFIG,
      conversation: DEFAULT_CONVERSATION_CONFIG,
      exploration: DEFAULT_EXPLORATION_PROBABILITY_CONFIG,
      time: DEFAULT_TIME_CONFIG,
    } satisfies WizPreset<WizDefaultTypes>
    const overrides = args[0] ?? ({} as WizPresetCreateOverrides<T>)
    return new WizPresetValue(
      wizPresetConstructionToken,
      mergePreset(base as unknown as WizPreset<T>, overrides)
    )
  }

  /**
   * 完全なpreset objectを検証し、所有権を切ったimmutable valueへ変換する。
   */
  static from<T extends WizTypes = WizDefaultTypes>(
    preset: WizPreset<T>
  ): WizPresetValue<T> {
    if (preset instanceof WizPresetValue) {
      assertAuthenticWizPresetValue(preset)
      return preset
    }
    return new WizPresetValue(wizPresetConstructionToken, preset)
  }

  with(overrides: WizPresetOverrides<T>): WizPresetValue<T> {
    assertAuthenticWizPresetValue(this)

    return new WizPresetValue(
      wizPresetConstructionToken,
      mergePreset(this, overrides)
    )
  }
}

Object.freeze(WizPresetValue.prototype)
Object.freeze(WizPresetValue)
