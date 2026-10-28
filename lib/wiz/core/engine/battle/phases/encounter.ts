import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import { WizEngineBattlePhaseBattle } from "@/lib/wiz/core/engine/battle/phases/base"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"

type Properties<TStatus = unknown, TCustom = unknown> = {
  readonly context: WizEngineBattleContext<TStatus, TCustom>
}

export class WizEngineBattleEncounter<
  TStatus = unknown,
  TCustom = unknown,
> extends WizEngineBattlePhaseBattle<TStatus, TCustom> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly phase = "encounter" as const
  readonly context: WizEngineBattleContext<TStatus, TCustom>

  constructor(properties: Properties<TStatus, TCustom>) {
    super()
    this.context = properties.context
    WizImmutableValue.freeze(this)
  }

  static create<TStatus = unknown, TCustom = unknown>(parameters: {
    id: string
    party: WizBattleParty<TStatus>
    enemies: WizBattleEnemyParty<TStatus, TCustom>
  }): WizEngineBattleEncounter<TStatus, TCustom> {
    const context = new WizEngineBattleContext<TStatus, TCustom>({
      id: parameters.id,
      turnNumber: 1,
      party: parameters.party,
      enemies: parameters.enemies,
      executedActions: [],
      initiative: "none",
    })
    return new WizEngineBattleEncounter({ context })
  }
}
