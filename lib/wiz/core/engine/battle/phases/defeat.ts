import type { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import { WizEngineBattlePhaseBattle } from "@/lib/wiz/core/engine/battle/phases/base"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"

type Properties<TStatus = unknown, TCustom = unknown> = {
  readonly context: WizEngineBattleContext<TStatus, TCustom>
}

export class WizEngineBattlePhaseDefeat<
  TStatus = unknown,
  TCustom = unknown,
> extends WizEngineBattlePhaseBattle<TStatus, TCustom> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly phase = "defeat" as const
  readonly context: WizEngineBattleContext<TStatus, TCustom>

  constructor(properties: Properties<TStatus, TCustom>) {
    super()
    this.context = properties.context
    WizImmutableValue.freeze(this)
  }

  isTerminal(): true {
    return true
  }

  getResult(): "defeat" {
    return "defeat"
  }
}
