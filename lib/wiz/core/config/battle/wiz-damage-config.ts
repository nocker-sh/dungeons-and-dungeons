import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type { WizBattleStatusBase, WizDefaultBattleStatus } from "@/lib/wiz/core/types/wiz-types"

/**
 * ダメージ計算設定
 *
 * @template TBattleStatus - `WizBattleActorState.toFormulaView()` が返す完全な戦闘ステータス型
 */
export type WizDamageFormula<TBattleStatus extends WizBattleStatusBase = WizDefaultBattleStatus> = (
  attackerStatus: TBattleStatus,
  defenderStatus: TBattleStatus,
) => number

export type WizEvasionFormula<TBattleStatus extends WizBattleStatusBase = WizDefaultBattleStatus> =
  (defenderStatus: TBattleStatus) => number

export type WizDamageConfig<TBattleStatus extends WizBattleStatusBase = WizDefaultBattleStatus> = {
  readonly damageFormula: WizDamageFormula<TBattleStatus>
  readonly evasionFormula: WizEvasionFormula<TBattleStatus>
  readonly criticalChance: number
  readonly criticalMultiplier: number
  readonly backAttackMultiplier: number
  readonly defendMultiplier: number
  readonly varianceMin: number
  readonly varianceMax: number
  readonly minimumDamage: number
}

export const DEFAULT_DAMAGE_CONFIG: WizDamageConfig<WizDefaultBattleStatus> = immutableConfig({
  damageFormula: (attacker, defender) => Math.max(0, attacker.attack - defender.defense / 2),
  evasionFormula: (defender) => Math.min(defender.speed / 200, 0.3),
  criticalChance: 0.05,
  criticalMultiplier: 1.5,
  backAttackMultiplier: 1.25,
  defendMultiplier: 0.5,
  varianceMin: 0.9,
  varianceMax: 1.1,
  minimumDamage: 1,
})

/**
 * 型パラメータ付きのデフォルト設定を生成
 *
 * ジェネリック型で Calculator を使う場合はこちらを使用
 */
export function createDefaultDamageConfig<
  TBattleStatus extends WizBattleStatusBase,
>(): WizDamageConfig<TBattleStatus> {
  return immutableConfig({
    damageFormula: (attacker, defender) => Math.max(0, attacker.attack - defender.defense / 2),
    evasionFormula: (defender) => Math.min(defender.speed / 200, 0.3),
    criticalChance: 0.05,
    criticalMultiplier: 1.5,
    backAttackMultiplier: 1.25,
    defendMultiplier: 0.5,
    varianceMin: 0.9,
    varianceMax: 1.1,
    minimumDamage: 1,
  })
}
