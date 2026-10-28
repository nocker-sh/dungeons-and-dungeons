import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"

/**
 * 探索アクション中の遭遇確率と空腹コストのパラメータ。
 *
 * `WizSceneExplorationReducer` に DI して、ゲームバランスをチューニングできる。
 * デフォルトは {@link DEFAULT_EXPLORATION_PROBABILITY_CONFIG}。
 */
export type WizExplorationProbabilityConfig = {
  /** 「探索」時のモンスター遭遇基礎確率 (%)。timeEffect.monsterEncounterRate で乗算される。 */
  readonly monsterEncounterBase: number
  /** 「探索」時のイベント発生基礎確率 (%)。weatherEffect.explorationBonus * eventWeatherCoefficient で増減する。 */
  readonly eventBase: number
  /** イベント確率の下限 (%)。 */
  readonly eventMin: number
  /** イベント確率の上限 (%)。 */
  readonly eventMax: number
  /** weatherEffect.explorationBonus に乗算される係数。 */
  readonly eventWeatherCoefficient: number
  /** エリアの危険度から空腹コストを算出する関数。 */
  readonly hungerCostFromDangerLevel: (dangerLevel: number) => number
}

export const DEFAULT_EXPLORATION_PROBABILITY_CONFIG: WizExplorationProbabilityConfig =
  immutableConfig({
    monsterEncounterBase: 40,
    eventBase: 50,
    eventMin: 15,
    eventMax: 70,
    eventWeatherCoefficient: 5,
    hungerCostFromDangerLevel: (dangerLevel) => {
      if (dangerLevel <= 2) return 8
      if (dangerLevel <= 4) return 10
      return 12
    },
  })
