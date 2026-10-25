import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type {
  WizBattleStatusBase,
  WizBattleStatusCustom,
  WizDefaultBattleStatus,
} from "@/lib/wiz/core/types/wiz-types"

/**
 * プレイヤーの能力値から戦闘ステータスへの変換設定
 *
 * デフォルトの線形変換式:
 * - attack = attackBase + strength * attackPerStrength
 * - defense = defenseBase + vitality * defensePerVitality
 * - speed = speedBase + agility * speedPerAgility
 *
 * `attackFormula` / `defenseFormula` / `speedFormula` を設定すると、
 * 線形変換を完全に置き換えられる (input には customAttributes も含まれる)。
 *
 * @example luck をクリティカル要素ではなく速度に乗せる:
 * ```ts
 * WizPresetValue.create({
 *   statusConversion: {
 *     speedFormula: (input) =>
 *       input.agility + (input.customAttributes?.luck ?? 0) * 0.5,
 *   },
 * })
 * ```
 */
export type WizStatusConversionInput = {
  readonly hp: number
  readonly maxHp: number
  readonly mp?: number
  readonly maxMp?: number
  readonly strength: number
  readonly vitality: number
  readonly agility: number
  readonly wisdom?: number
  readonly customAttributes?: Readonly<Record<string, number>>
}

export type WizStatusConversionLinearConfig = {
  readonly attackBase: number
  readonly attackPerStrength: number
  readonly defenseBase: number
  readonly defensePerVitality: number
  readonly speedBase: number
  readonly speedPerAgility: number
  readonly maxHpBase: number
  readonly maxHpPerVitality: number
  readonly maxMpBase: number
  readonly maxMpPerWisdom: number
}

export type WizBattleStatusFormula<TBattleStatus extends WizBattleStatusBase> = (
  input: WizStatusConversionInput,
  base: WizDefaultBattleStatus,
) => TBattleStatus

export type WizCustomBattleStatusFormula<TBattleStatus extends WizBattleStatusBase> = (
  input: WizStatusConversionInput,
  base: WizDefaultBattleStatus,
) => WizBattleStatusCustom<TBattleStatus>

type WizStatusConversionFormulaConfig<TBattleStatus extends WizBattleStatusBase> = [
  keyof WizBattleStatusCustom<TBattleStatus>,
] extends [never]
  ? {
      /** 標準fieldを含む完全な戦闘ステータスを生成する式。 */
      readonly battleStatusFormula?: WizBattleStatusFormula<TBattleStatus>
      /** 標準fieldへ追加するcustom fieldsだけを生成する式。 */
      readonly customStatusFormula?: WizCustomBattleStatusFormula<TBattleStatus>
    }
  :
      | {
          /** 標準fieldを含む完全な戦闘ステータスを生成する式。 */
          readonly battleStatusFormula: WizBattleStatusFormula<TBattleStatus>
          readonly customStatusFormula?: WizCustomBattleStatusFormula<TBattleStatus>
        }
      | {
          readonly battleStatusFormula?: WizBattleStatusFormula<TBattleStatus>
          /** 標準fieldへ追加するcustom fieldsだけを生成する式。 */
          readonly customStatusFormula: WizCustomBattleStatusFormula<TBattleStatus>
        }

export type WizStatusConversionConfig<
  TBattleStatus extends WizBattleStatusBase = WizDefaultBattleStatus,
> = WizStatusConversionLinearConfig &
  WizStatusConversionFormulaConfig<TBattleStatus> & {
    /** 攻撃力を完全に上書きする式。設定すれば attackBase / attackPerStrength は無視される。 */
    readonly attackFormula?: (input: WizStatusConversionInput) => number
    /** 防御力を完全に上書きする式。 */
    readonly defenseFormula?: (input: WizStatusConversionInput) => number
    /** 速度を完全に上書きする式。 */
    readonly speedFormula?: (input: WizStatusConversionInput) => number
  }

export type WizStatusConversionOverrides<
  TBattleStatus extends WizBattleStatusBase = WizDefaultBattleStatus,
> = Partial<WizStatusConversionLinearConfig> &
  WizStatusConversionFormulaConfig<TBattleStatus> & {
    readonly attackFormula?: (input: WizStatusConversionInput) => number
    readonly defenseFormula?: (input: WizStatusConversionInput) => number
    readonly speedFormula?: (input: WizStatusConversionInput) => number
  }

export type WizStatusConversionPatch<
  TBattleStatus extends WizBattleStatusBase = WizDefaultBattleStatus,
> = Partial<
  WizStatusConversionLinearConfig & {
    readonly battleStatusFormula: WizBattleStatusFormula<TBattleStatus>
    readonly customStatusFormula: WizCustomBattleStatusFormula<TBattleStatus>
    readonly attackFormula: (input: WizStatusConversionInput) => number
    readonly defenseFormula: (input: WizStatusConversionInput) => number
    readonly speedFormula: (input: WizStatusConversionInput) => number
  }
>

export const DEFAULT_STATUS_CONVERSION_CONFIG = immutableConfig({
  attackBase: 10,
  attackPerStrength: 2,
  defenseBase: 5,
  defensePerVitality: 1,
  speedBase: 0,
  speedPerAgility: 1,
  maxHpBase: 30,
  maxHpPerVitality: 4,
  maxMpBase: 10,
  maxMpPerWisdom: 3,
} as const satisfies WizStatusConversionConfig<WizDefaultBattleStatus>)
