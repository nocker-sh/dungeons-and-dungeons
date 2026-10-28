import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"

const resultOwnership = new WizObjectService()
const wizEngineBattleExecutionResultConstructionToken = Symbol(
  "WizEngineBattleExecutionResult.constructor"
)
const authenticWizEngineBattleExecutionResults = new WeakSet<object>()

export type WizEngineBattleExecutionRejectionReason = "BATTLE_ACTION_REJECTED"

type AcceptedProperties<TStatus = unknown, TMonsterCustom = unknown> = {
  readonly party: WizBattleParty<TStatus>
  readonly enemies: WizBattleEnemyParty<TStatus, TMonsterCustom>
  readonly logs?: readonly WizLogMessage[]
  readonly success: boolean
  readonly action?: WizEngineBattleTurnAction
}

type RejectedProperties<
  TStatus = unknown,
  TMonsterCustom = unknown,
  TReason extends string = WizEngineBattleExecutionRejectionReason,
> = {
  readonly party: WizBattleParty<TStatus>
  readonly enemies: WizBattleEnemyParty<TStatus, TMonsterCustom>
  readonly reason: TReason
}

export type WizEngineBattleExecutionResultProperties<
  TStatus = unknown,
  TMonsterCustom = unknown,
  TReason extends string = WizEngineBattleExecutionRejectionReason,
> =
  | (AcceptedProperties<TStatus, TMonsterCustom> & {
      readonly accepted: true
      readonly reason: undefined
    })
  | (RejectedProperties<TStatus, TMonsterCustom, TReason> & {
      readonly accepted: false
      readonly logs: readonly []
      readonly success: false
      readonly action: undefined
    })

export class WizEngineBattleExecutionResult<
  TStatus = unknown,
  TMonsterCustom = unknown,
  TReason extends string = WizEngineBattleExecutionRejectionReason,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly party: WizBattleParty<TStatus>
  readonly enemies: WizBattleEnemyParty<TStatus, TMonsterCustom>
  readonly logs: readonly WizLogMessage[]
  readonly success: boolean
  readonly accepted: boolean
  readonly reason: TReason | undefined
  readonly action: WizEngineBattleTurnAction | undefined

  private constructor(
    token: typeof wizEngineBattleExecutionResultConstructionToken,
    properties:
      | (AcceptedProperties<TStatus, TMonsterCustom> & {
          readonly accepted: true
        })
      | (RejectedProperties<TStatus, TMonsterCustom, TReason> & {
          readonly accepted: false
        })
  ) {
    if (token !== wizEngineBattleExecutionResultConstructionToken) {
      throw new TypeError(
        "WizEngineBattleExecutionResult must be created with accept() or reject()"
      )
    }

    this.party = properties.party
    this.enemies = properties.enemies
    this.accepted = properties.accepted
    if (properties.accepted) {
      if (properties.action !== undefined) {
        WizEngineBattleTurnAction.assertAuthentic(properties.action)
      }
      this.logs = resultOwnership.ownImmutable(properties.logs ?? [])
      this.success = properties.success
      this.reason = undefined
      this.action = properties.action
    } else {
      if (
        properties.reason.trim().length === 0 ||
        properties.reason !== properties.reason.trim()
      ) {
        throw new RangeError(
          "Battle execution rejection reason must not be blank or have surrounding whitespace"
        )
      }
      this.logs = Object.freeze([])
      this.success = false
      this.reason = properties.reason
      this.action = undefined
    }
    authenticWizEngineBattleExecutionResults.add(this)
    WizImmutableValue.freeze(this)
  }

  static accept<TStatus = unknown, TMonsterCustom = unknown>(
    properties: AcceptedProperties<TStatus, TMonsterCustom>
  ): WizEngineBattleExecutionResult<TStatus, TMonsterCustom, never> {
    return new WizEngineBattleExecutionResult(
      wizEngineBattleExecutionResultConstructionToken,
      {
        ...properties,
        accepted: true,
      }
    )
  }

  static reject<
    TStatus = unknown,
    TMonsterCustom = unknown,
    const TReason extends string = WizEngineBattleExecutionRejectionReason,
  >(
    properties: RejectedProperties<TStatus, TMonsterCustom, TReason>
  ): WizEngineBattleExecutionResult<TStatus, TMonsterCustom, TReason> {
    return new WizEngineBattleExecutionResult(
      wizEngineBattleExecutionResultConstructionToken,
      {
        ...properties,
        accepted: false,
      }
    )
  }

  /** @internal executor authority boundary only. */
  static assertAuthentic(
    result: unknown
  ): asserts result is WizEngineBattleExecutionResult<
    unknown,
    unknown,
    string
  > {
    if (
      typeof result !== "object" ||
      result === null ||
      !authenticWizEngineBattleExecutionResults.has(result)
    ) {
      throw new TypeError(
        "Battle executor must return an authentic WizEngineBattleExecutionResult"
      )
    }
  }

  isAccepted(): this is this &
    Readonly<{
      accepted: true
      reason: undefined
    }> {
    WizEngineBattleExecutionResult.assertAuthentic(this)
    return this.accepted
  }

  isRejected(): this is this &
    Readonly<{
      accepted: false
      reason: TReason
      success: false
      logs: readonly []
      action: undefined
    }> {
    WizEngineBattleExecutionResult.assertAuthentic(this)
    return !this.accepted
  }

  withParty(
    party: WizBattleParty<TStatus>
  ): WizEngineBattleExecutionResult<TStatus, TMonsterCustom, TReason> {
    WizEngineBattleExecutionResult.assertAuthentic(this)
    if (this.isRejected()) return this
    return WizEngineBattleExecutionResult.accept({
      party,
      enemies: this.enemies,
      logs: this.logs,
      success: this.success,
      action: this.action,
    })
  }

  withEnemies(
    enemies: WizBattleEnemyParty<TStatus, TMonsterCustom>
  ): WizEngineBattleExecutionResult<TStatus, TMonsterCustom, TReason> {
    WizEngineBattleExecutionResult.assertAuthentic(this)
    if (this.isRejected()) return this
    return WizEngineBattleExecutionResult.accept({
      party: this.party,
      enemies,
      logs: this.logs,
      success: this.success,
      action: this.action,
    })
  }

  withLogs(
    logs: readonly WizLogMessage[]
  ): WizEngineBattleExecutionResult<TStatus, TMonsterCustom, TReason> {
    WizEngineBattleExecutionResult.assertAuthentic(this)
    if (this.isRejected()) return this
    return WizEngineBattleExecutionResult.accept({
      party: this.party,
      enemies: this.enemies,
      logs,
      success: this.success,
      action: this.action,
    })
  }

  withAddedLog(
    log: WizLogMessage
  ): WizEngineBattleExecutionResult<TStatus, TMonsterCustom, TReason> {
    WizEngineBattleExecutionResult.assertAuthentic(this)
    if (this.isRejected()) return this
    return WizEngineBattleExecutionResult.accept({
      party: this.party,
      enemies: this.enemies,
      logs: [...this.logs, log],
      success: this.success,
      action: this.action,
    })
  }

  withAction(
    action: WizEngineBattleTurnAction
  ): WizEngineBattleExecutionResult<TStatus, TMonsterCustom, TReason> {
    WizEngineBattleExecutionResult.assertAuthentic(this)
    if (this.isRejected()) return this
    return WizEngineBattleExecutionResult.accept({
      party: this.party,
      enemies: this.enemies,
      logs: this.logs,
      success: this.success,
      action,
    })
  }

  toProperties(): WizEngineBattleExecutionResultProperties<
    TStatus,
    TMonsterCustom,
    TReason
  > {
    WizEngineBattleExecutionResult.assertAuthentic(this)
    if (this.isRejected()) {
      return {
        party: this.party,
        enemies: this.enemies,
        logs: Object.freeze([]),
        success: false,
        accepted: false,
        reason: this.reason,
        action: undefined,
      }
    }

    return {
      party: this.party,
      enemies: this.enemies,
      logs: this.logs,
      success: this.success,
      accepted: true,
      reason: undefined,
      action: this.action,
    }
  }
}

Object.freeze(WizEngineBattleExecutionResult.prototype)
Object.freeze(WizEngineBattleExecutionResult)
