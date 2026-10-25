import type { WizEngineBattlePhaseDefeat } from "@/lib/wiz/core/engine/battle/phases/defeat"
import type { WizEngineBattleEncounter } from "@/lib/wiz/core/engine/battle/phases/encounter"
import type { WizEngineBattlePhaseTurnOrder } from "@/lib/wiz/core/engine/battle/phases/turn-order"
import type { WizEngineBattlePhaseVictory } from "@/lib/wiz/core/engine/battle/phases/victory"
import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const objectService = new WizObjectService()

export type WizStateBattlePhase<TStatus = unknown, TCustom = unknown, TRewardCustom = undefined> =
  | WizEngineBattleEncounter<TStatus, TCustom>
  | WizEngineBattlePhaseTurnOrder<TStatus, TCustom>
  | WizEngineBattlePhaseVictory<TStatus, TCustom, TRewardCustom>
  | WizEngineBattlePhaseDefeat<TStatus, TCustom>

export type WizSceneBattleOutcome =
  | { readonly type: "ongoing" }
  | {
      readonly type: "victory"
      readonly expGained: number
      readonly goldGained: number
    }
  | { readonly type: "defeat" }
  | { readonly type: "fled" }

export type WizStateBattleDefinition<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
> = {
  readonly type: "battle"
  readonly phase: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>
  readonly returnAreaId: string
  readonly vault: WizVaultValue
}

export class WizStateBattle<TStatus = unknown, TCustom = unknown, TRewardCustom = undefined> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "battle" as const
  private readonly properties: WizStateBattleDefinition<TStatus, TCustom, TRewardCustom>

  constructor(properties: WizStateBattleDefinition<TStatus, TCustom, TRewardCustom>) {
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get vault() {
    return this.properties.vault
  }

  get phase(): WizStateBattlePhase<TStatus, TCustom, TRewardCustom> {
    return this.properties.phase
  }

  get returnAreaId() {
    return this.properties.returnAreaId
  }

  withPhase(
    phase: WizStateBattlePhase<TStatus, TCustom, TRewardCustom>,
  ): WizStateBattle<TStatus, TCustom, TRewardCustom> {
    return new WizStateBattle<TStatus, TCustom, TRewardCustom>({
      ...this.properties,
      phase: phase,
    })
  }

  withVault(vault: WizVaultValue): WizStateBattle<TStatus, TCustom, TRewardCustom> {
    return new WizStateBattle<TStatus, TCustom, TRewardCustom>({
      ...this.properties,
      vault,
    })
  }

  updateVault(
    fn: (v: WizVaultValue) => WizVaultValue,
  ): WizStateBattle<TStatus, TCustom, TRewardCustom> {
    return new WizStateBattle<TStatus, TCustom, TRewardCustom>({
      ...this.properties,
      vault: fn(this.properties.vault),
    })
  }
}

Object.freeze(WizStateBattle.prototype)
Object.freeze(WizStateBattle)
