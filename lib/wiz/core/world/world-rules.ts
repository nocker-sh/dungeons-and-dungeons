import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type {
  WizStandardSchemaDefinition,
  WizStandardSchemaInput,
} from "@/lib/wiz/core/standard-schema"
import {
  WizWorldEventReaction,
  type WizWorldEventReactionDefinition,
  WizWorldModule,
  type WizWorldModuleDefinition,
  type WizWorldSchemaModuleDefinition,
} from "@/lib/wiz/core/world/world"

const worldRulesConstructionToken = Symbol("WizWorldRules.constructor")

/**
 * state型を一度だけ束縛し、rule定義の残りをcallbackから推論する不変factory。
 *
 * 高度なgeneric指定や独自合成が必要な場合は、低レベルの`WizWorldModule`と
 * `WizWorldEventReaction`を直接利用できる。
 */
export class WizWorldRules<TState> {
  declare private readonly stateType: (state: TState) => TState

  private constructor(token: symbol) {
    if (token !== worldRulesConstructionToken) {
      throw new TypeError(
        "WizWorldRules must be created with WizWorldRules.forState()"
      )
    }

    Object.freeze(this)
  }

  static forState<TState>(): WizWorldRules<TState> {
    return new WizWorldRules<TState>(worldRulesConstructionToken)
  }

  module<TAction, const TEvent = never, const TReason extends string = never>(
    definition: WizWorldModuleDefinition<TState, TAction, TEvent, TReason>
  ): WizWorldModule<TState, TAction, TEvent, TReason> {
    return WizWorldModule.define<TState, TAction, TEvent, TReason>(definition)
  }

  schema<
    TSchema extends WizStandardSchemaDefinition,
    const TEvent = never,
    const TReason extends string = never,
  >(
    definition: WizWorldSchemaModuleDefinition<TState, TSchema, TEvent, TReason>
  ): WizWorldModule<
    TState,
    WizDeepReadonly<WizStandardSchemaInput<TSchema>>,
    TEvent,
    TReason
  > {
    return WizWorldModule.fromSchema<TState, TSchema, TEvent, TReason>(
      definition
    )
  }

  reaction<
    TObservedEvent,
    const TEmittedEvent = never,
    const TReason extends string = never,
  >(
    definition: WizWorldEventReactionDefinition<
      TState,
      TObservedEvent,
      TEmittedEvent,
      TReason
    >
  ): WizWorldEventReaction<TState, TObservedEvent, TEmittedEvent, TReason> {
    return WizWorldEventReaction.define<
      TState,
      TObservedEvent,
      TEmittedEvent,
      TReason
    >(definition)
  }
}

Object.freeze(WizWorldRules.prototype)
Object.freeze(WizWorldRules)
