import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizRpgMechanics } from "@/lib/wiz/core/presets/rpg-mechanics"
import { WizPresetValue, type WizPreset } from "@/lib/wiz/core/presets/wiz-preset"
import { WizStandardRewardCustomCodec } from "@/lib/wiz/core/presets/standard-session"
import type { WizSceneBattleMonsterAuthority } from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import type {
  WizBattleMonsterCustom,
  WizBattleStatusCustom,
  WizTypes,
} from "@/lib/wiz/core/types/wiz-types"

const battleModelConstructionToken = Symbol("WizRpgBattleModel.constructor")
const authenticBattleModels = new WeakSet<object>()

type WizRpgBattleModelRewardCodec<TRewardCustom, TRewardInput> = [TRewardCustom] extends [undefined]
  ? Readonly<{
      rewardCodec?: undefined
    }>
  : Readonly<{
      rewardCodec: WizStandardRewardCustomCodec<TRewardCustom, TRewardInput>
    }>

export type WizRpgBattleModelDefinition<
  TTypes extends WizTypes,
  TRewardCustom,
  TRewardInput,
  TArrays extends WorldContentArrays,
  TReason extends string,
> = Readonly<{
  preset: WizPreset<TTypes>
  mechanics: WizRpgMechanics<TTypes, TRewardCustom, TArrays, TReason>
  monsterAdapter: WizSceneBattleMonsterAuthority<
    WizBattleStatusCustom<TTypes["BattleStatus"]>,
    WizBattleMonsterCustom<TTypes>
  >
}> &
  WizRpgBattleModelRewardCodec<TRewardCustom, TRewardInput>

/**
 * custom battle status・monster data・rewardを一つの型境界で束ねる不変model。
 *
 * world definitionへ渡す時点で、preset・mechanics・monster adapter・save codecの
 * 型が一致していなければコンパイルできない。
 */
export class WizRpgBattleModel<
  TTypes extends WizTypes,
  TRewardCustom,
  TRewardInput,
  TArrays extends WorldContentArrays,
  TReason extends string,
> {
  readonly preset: WizPresetValue<TTypes>
  readonly mechanics: WizRpgMechanics<TTypes, TRewardCustom, TArrays, TReason>
  readonly monsterAdapter: WizSceneBattleMonsterAuthority<
    WizBattleStatusCustom<TTypes["BattleStatus"]>,
    WizBattleMonsterCustom<TTypes>
  >
  readonly rewardCodec: WizStandardRewardCustomCodec<TRewardCustom, TRewardInput> | undefined

  private constructor(
    token: symbol,
    definition: WizRpgBattleModelDefinition<TTypes, TRewardCustom, TRewardInput, TArrays, TReason>,
  ) {
    if (token !== battleModelConstructionToken) {
      throw new TypeError("WizRpgBattleModel must be created with defineForContent()")
    }
    WizRpgMechanics.require(definition.mechanics, "RPG battle model mechanics")
    if (definition.rewardCodec !== undefined) {
      WizStandardRewardCustomCodec.require(definition.rewardCodec, "RPG battle model reward codec")
    }
    if (
      typeof definition.monsterAdapter !== "object" ||
      definition.monsterAdapter === null ||
      typeof definition.monsterAdapter.enemiesFromMonsters !== "function"
    ) {
      throw new TypeError("RPG battle model monster adapter must provide enemiesFromMonsters()")
    }
    this.preset = WizPresetValue.from(definition.preset)
    this.mechanics = definition.mechanics
    this.monsterAdapter = Object.freeze({
      enemiesFromMonsters: Object.freeze(
        definition.monsterAdapter.enemiesFromMonsters.bind(definition.monsterAdapter),
      ),
    })
    this.rewardCodec = definition.rewardCodec
    authenticBattleModels.add(this)
    Object.freeze(this)
  }

  static defineForContent<
    const TArrays extends WorldContentArrays,
    TTypes extends WizTypes,
    TRewardCustom,
    TRewardInput,
    const TReason extends string,
  >(
    content: WorldContent<TArrays>,
    definition: WizRpgBattleModelDefinition<TTypes, TRewardCustom, TRewardInput, TArrays, TReason>,
  ): WizRpgBattleModel<TTypes, TRewardCustom, TRewardInput, TArrays, TReason> {
    WorldContent.require(content, "RPG battle model content")
    return new WizRpgBattleModel(battleModelConstructionToken, definition)
  }

  /** @internal standard world composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticBattleModels.has(value)) {
      throw new TypeError(`${label} must be created with WizRpgBattleModel.defineForContent()`)
    }
  }
}

Object.freeze(WizRpgBattleModel.prototype)
Object.freeze(WizRpgBattleModel)
