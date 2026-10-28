import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type {
  WizPluginSceneAction,
  WizPluginSceneState,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import { WizPluginSceneNavigation } from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"
import type {
  WizPluginSceneAcceptedResult,
  WizPluginSceneResult,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-result"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"
import type {
  PluginSceneActionDefinition,
  PluginSceneNavigationDefinition,
  PluginSceneResultReason,
  WizPluginSceneNavigationRejectionReason,
} from "@/lib/wiz/core/runtime/plugin/is-authentic-wiz-plugin-scene-module"
import { getWizPluginSceneResolvedActionCanonical } from "@/lib/wiz/core/runtime/plugin/get-wiz-plugin-scene-resolved-action-canonical"
import {
  pluginSceneModuleStateType,
  pluginSceneModuleActionInputType,
  pluginSceneModuleActionOutputType,
  pluginSceneModuleResultType,
} from "@/lib/wiz/core/runtime/plugin/is-authentic-wiz-plugin-scene-module"

export type WizPluginSceneModuleDefinition<
  TState extends WizPluginSceneState,
  TActionSchema extends WizStandardSchemaDefinition<
    unknown,
    WizPluginSceneAction
  >,
  TNavigationSchema extends WizStandardSchemaDefinition,
  TResult extends WizPluginSceneResult<TState, unknown, string>,
> = PluginSceneActionDefinition<TState, TActionSchema, TResult> &
  Readonly<{
    navigation: PluginSceneNavigationDefinition<TState, TNavigationSchema>
  }>

export const ownedPluginSceneResolvedActions = new WeakSet<object>()

export const pluginSceneResolvedActionAuthorities = new WeakMap<
  object,
  Readonly<{
    canonicalAction: WizDeepReadonly<WizPluginSceneAction>
    module: object
  }>
>()

export const pluginSceneModuleOwnership = new WizObjectService()

export const pluginSceneResolvedActionToken = Symbol(
  "WizPluginSceneResolvedAction"
)

export type PluginSceneResultEvent<TResult> =
  TResult extends WizPluginSceneAcceptedResult<
    WizPluginSceneState,
    infer TEvent
  >
    ? TEvent
    : never

/**
 * Standard Schemaを通過したcanonical actionと、その入力・module authorityを一体化する。
 *
 * constructor tokenとmodule identityにより、schema検証を迂回した値はreducerへ渡せない。
 */
export class WizPluginSceneResolvedAction<
  TInput = unknown,
  TOutput extends WizPluginSceneAction = WizPluginSceneAction,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  declare private readonly inputInvariant: (input: TInput) => TInput

  private constructor(
    token: symbol,
    module: object,
    canonicalAction: WizDeepReadonly<TOutput>
  ) {
    if (token !== pluginSceneResolvedActionToken) {
      throw new TypeError(
        "Resolved plugin scene actions must be created by their scene module"
      )
    }

    pluginSceneResolvedActionAuthorities.set(
      this,
      Object.freeze({
        canonicalAction,
        module,
      })
    )
    ownedPluginSceneResolvedActions.add(this)
    WizImmutableValue.freeze(this)
  }

  /** @internal */
  static create<TInput, TOutput extends WizPluginSceneAction>(
    token: symbol,
    module: object,
    canonicalAction: WizDeepReadonly<TOutput>
  ): WizPluginSceneResolvedAction<TInput, TOutput> {
    return new WizPluginSceneResolvedAction<TInput, TOutput>(
      token,
      module,
      canonicalAction
    )
  }

  belongsTo(module: object): boolean {
    return getWizPluginSceneResolvedActionCanonical(this, module) !== null
  }

  getCanonicalAction(module: object): WizDeepReadonly<TOutput> | null {
    return getWizPluginSceneResolvedActionCanonical(this, module)
  }
}

Object.freeze(WizPluginSceneResolvedAction.prototype)

Object.freeze(WizPluginSceneResolvedAction)

export type WizPluginSceneModuleState<TModule> = TModule extends {
  readonly [pluginSceneModuleStateType]: infer TState
}
  ? TState extends WizPluginSceneState
    ? TState
    : never
  : never

export type WizPluginSceneModuleActionInput<TModule> = TModule extends {
  readonly [pluginSceneModuleActionInputType]: infer TAction
}
  ? TAction
  : never

export type WizPluginSceneModuleActionOutput<TModule> = TModule extends {
  readonly [pluginSceneModuleActionOutputType]: infer TAction
}
  ? TAction extends WizPluginSceneAction
    ? TAction
    : never
  : never

export type WizPluginSceneModuleEvent<TModule> = TModule extends {
  readonly [pluginSceneModuleResultType]: infer TResult
}
  ? PluginSceneResultEvent<TResult>
  : never

export type WizPluginSceneModuleReason<TModule> = TModule extends {
  readonly [pluginSceneModuleResultType]: infer TResult
}
  ? PluginSceneResultReason<TResult>
  : never

export type WizPluginSceneNavigationModule = Readonly<{
  type: string
  resolveNavigation(
    previousState: WizPluginSceneState,
    navigation: WizPluginSceneNavigation
  ): WizPluginSceneState | WizPluginSceneNavigationRejectionReason | null
}>
