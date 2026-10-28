import type { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import { WizEngineBattlePhaseBattle } from "@/lib/wiz/core/engine/battle/phases/base"
import type { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"

type Properties<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
> = {
  readonly context: WizEngineBattleContext<TStatus, TCustom>
  readonly reward?: WizEngineBattleReward<TRewardCustom>
}

export class WizEngineBattlePhaseVictory<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
> extends WizEngineBattlePhaseBattle<TStatus, TCustom> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly phase = "victory" as const
  readonly context: WizEngineBattleContext<TStatus, TCustom>
  readonly reward?: WizEngineBattleReward<TRewardCustom>

  constructor(properties: Properties<TStatus, TCustom, TRewardCustom>) {
    super()
    this.context = properties.context
    this.reward = properties.reward
    WizImmutableValue.freeze(this)
  }

  isTerminal(): true {
    return true
  }

  getResult(): "victory" {
    return "victory"
  }

  withReward(
    reward: WizEngineBattleReward<TRewardCustom>
  ): WizEngineBattlePhaseVictory<TStatus, TCustom, TRewardCustom> {
    return new WizEngineBattlePhaseVictory<TStatus, TCustom, TRewardCustom>({
      context: this.context,
      reward,
    })
  }
}
