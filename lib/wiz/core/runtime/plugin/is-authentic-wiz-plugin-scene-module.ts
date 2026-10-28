import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import type {
  WizPluginSceneAction,
  WizPluginSceneState,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import { createPluginSceneNavigation } from "@/lib/wiz/core/runtime/plugin/create-plugin-scene-navigation"
import { getWizPluginSceneNavigationPayload } from "@/lib/wiz/core/runtime/plugin/get-wiz-plugin-scene-navigation-payload"
import { WizPluginSceneNavigation } from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"
import { WizStandardSceneName } from "@/lib/wiz/core/runtime/standard-scene-name"
import type {
  WizPluginSceneRejectedResult,
  WizPluginSceneResult,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-result"
import { WizSceneResultFactory } from "@/lib/wiz/core/runtime/scene-result"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import { WizStandardSchema } from "@/lib/wiz/core/standard-schema"
import type {
  WizStandardSchemaDefinition,
  WizStandardSchemaInput,
  WizStandardSchemaOutput,
} from "@/lib/wiz/core/standard-schema"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import {
  WizPluginSceneResolvedAction,
  pluginSceneResolvedActionToken,
  pluginSceneModuleOwnership,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"
import { getCanonicalPluginSceneAction } from "@/lib/wiz/core/runtime/plugin/get-canonical-plugin-scene-action"
import { getWizPluginSceneResolvedActionCanonical } from "@/lib/wiz/core/runtime/plugin/get-wiz-plugin-scene-resolved-action-canonical"
import { getSynchronousSchemaValue } from "@/lib/wiz/core/runtime/plugin/get-synchronous-schema-value"

export type WizPluginSceneActionTypeConflict<
  TAction extends WizPluginSceneAction,
> = Extract<WizAction["type"], TAction["type"]>

export type WizPluginSceneTypeConflict<TType extends string> = Extract<
  WizState["type"],
  TType
>

export type WizPluginSceneNavigationRejectionReason =
  | "TRANSITION_PLUGIN_SOURCE_NOT_ALLOWED"
  | "TRANSITION_PLUGIN_STATE_INVALID"

export type PluginSceneActionDefinition<
  TState extends WizPluginSceneState,
  TActionSchema extends WizStandardSchemaDefinition<
    unknown,
    WizPluginSceneAction
  >,
  TResult extends WizPluginSceneResult<TState, unknown, string>,
> = Readonly<{
  type: TState["type"]
  action: TActionSchema
  reduce: (
    state: WizDeepReadonly<TState>,
    action: WizDeepReadonly<WizStandardSchemaOutput<TActionSchema>>
  ) => TResult
}>

export type PluginSceneReducer<
  TState extends WizPluginSceneState,
  TActionSchema extends WizStandardSchemaDefinition<
    unknown,
    WizPluginSceneAction
  >,
> = (
  state: WizDeepReadonly<TState>,
  action: WizDeepReadonly<WizStandardSchemaOutput<TActionSchema>>
) => unknown

export type PluginSceneNavigationDefinition<
  TState extends WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition,
> = Readonly<{
  from: readonly string[]
  schema: TNavigationSchema
  create: (
    vault: WizVaultValue,
    payload: WizDeepReadonly<WizStandardSchemaOutput<TNavigationSchema>>
  ) => TState
}>

export type PluginSceneNavigationBehavior<
  TState extends WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition,
> = Readonly<{
  from: readonly string[]
  schema: WizStandardSchema<
    WizStandardSchemaInput<TNavigationSchema>,
    WizStandardSchemaOutput<TNavigationSchema>
  >
  create: (
    vault: WizVaultValue,
    payload: WizDeepReadonly<WizStandardSchemaOutput<TNavigationSchema>>
  ) => TState
}>

export const ownedPluginSceneModules = new WeakSet<object>()

export const pluginSceneModuleToken = Symbol("WizPluginSceneModule")

export declare const pluginSceneModuleStateType: unique symbol

export declare const pluginSceneModuleActionInputType: unique symbol

export declare const pluginSceneModuleActionOutputType: unique symbol

export declare const pluginSceneModuleResultType: unique symbol

export type PluginSceneResultReason<TResult> =
  TResult extends WizPluginSceneRejectedResult<
    WizPluginSceneState,
    infer TReason
  >
    ? TReason
    : never

export class WizPluginSceneModule<
  TState extends WizPluginSceneState,
  TActionSchema extends WizStandardSchemaDefinition<
    unknown,
    WizPluginSceneAction
  >,
  TNavigationSchema extends WizStandardSchemaDefinition,
  TReduce extends PluginSceneReducer<TState, TActionSchema>,
> {
  declare readonly [pluginSceneModuleStateType]: TState
  declare readonly [pluginSceneModuleActionInputType]: WizStandardSchemaInput<TActionSchema>
  declare readonly [pluginSceneModuleActionOutputType]: WizStandardSchemaOutput<TActionSchema>
  declare readonly [pluginSceneModuleResultType]: ReturnType<TReduce>
  readonly navigationSourceTypes: readonly string[]
  readonly type: TState["type"]
  readonly #actionSchema: WizStandardSchema<
    WizStandardSchemaInput<TActionSchema>,
    WizStandardSchemaOutput<TActionSchema>
  >
  readonly #navigation: PluginSceneNavigationBehavior<TState, TNavigationSchema>
  readonly #reduce: TReduce

  private constructor(
    token: symbol,
    type: TState["type"],
    action: TActionSchema,
    reduce: TReduce,
    navigation: PluginSceneNavigationDefinition<TState, TNavigationSchema>
  ) {
    if (token !== pluginSceneModuleToken) {
      throw new TypeError("Plugin scene modules must be created with define()")
    }
    if (type.trim().length === 0 || type !== type.trim()) {
      throw new RangeError(
        "Plugin scene type must be a non-empty trimmed string"
      )
    }
    if (WizStandardSceneName.isBuiltIn(type)) {
      throw new RangeError(`Plugin scene type "${type}" is reserved`)
    }
    if (navigation.from.length === 0) {
      throw new RangeError(
        `Plugin scene "${type}" requires a navigation source`
      )
    }
    for (const sourceType of navigation.from) {
      if (sourceType.trim().length === 0 || sourceType !== sourceType.trim()) {
        throw new RangeError(
          `Plugin scene "${type}" has an invalid navigation source`
        )
      }
    }

    this.type = type
    this.navigationSourceTypes = Object.freeze([...navigation.from])
    this.#reduce = reduce
    this.#actionSchema = WizStandardSchema.capture(
      action,
      `Plugin scene "${type}" action schema`
    )
    this.#navigation = Object.freeze({
      create: navigation.create,
      from: Object.freeze([...navigation.from]),
      schema: WizStandardSchema.capture(
        navigation.schema,
        `Plugin scene "${type}" navigation schema`
      ),
    })
    ownedPluginSceneModules.add(this)
    Object.freeze(this)
  }

  static define<
    const TType extends string,
    const TSourceType extends string,
    TState extends WizPluginSceneState & Readonly<{ type: TType }>,
    TActionSchema extends WizStandardSchemaDefinition<
      unknown,
      WizPluginSceneAction
    >,
    TNavigationSchema extends WizStandardSchemaDefinition,
    TReduce extends PluginSceneReducer<TState, TActionSchema>,
  >(
    definition: Readonly<{
      type: TType
      action: TActionSchema
      reduce: TReduce &
        PluginSceneActionDefinition<
          TState,
          TActionSchema,
          WizPluginSceneResult<TState, unknown, string>
        >["reduce"]
      navigation: PluginSceneNavigationDefinition<TState, TNavigationSchema> &
        Readonly<{
          from: readonly [TSourceType, ...TSourceType[]]
        }>
    }> &
      (string extends TType ? never : unknown) &
      (string extends TSourceType ? never : unknown) &
      ([WizPluginSceneTypeConflict<TType>] extends [never] ? unknown : never) &
      ([
        WizPluginSceneActionTypeConflict<
          WizStandardSchemaOutput<TActionSchema>
        >,
      ] extends [never]
        ? unknown
        : never) &
      (string extends PluginSceneResultReason<ReturnType<TReduce>>
        ? never
        : unknown)
  ): WizPluginSceneModule<TState, TActionSchema, TNavigationSchema, TReduce> {
    return new WizPluginSceneModule<
      TState,
      TActionSchema,
      TNavigationSchema,
      TReduce
    >(
      pluginSceneModuleToken,
      definition.type,
      definition.action,
      definition.reduce,
      definition.navigation
    )
  }

  acceptsAction(input: unknown): boolean {
    return this.resolveUnknownAction(input) !== null
  }

  isOwned(): boolean {
    return isAuthenticWizPluginSceneModule(this)
  }

  resolveAction(
    input: WizStandardSchemaInput<TActionSchema>
  ): WizPluginSceneResolvedAction<
    WizStandardSchemaInput<TActionSchema>,
    WizStandardSchemaOutput<TActionSchema>
  > | null {
    return this.resolveUnknownAction(input)
  }

  /** @internal unknown actionを所有済みschema出力へ変換する。 */
  resolveUnknownAction(
    input: unknown
  ): WizPluginSceneResolvedAction<
    WizStandardSchemaInput<TActionSchema>,
    WizStandardSchemaOutput<TActionSchema>
  > | null {
    const action = getCanonicalPluginSceneAction(this.#actionSchema, input)
    if (action === null) {
      return null
    }

    return WizPluginSceneResolvedAction.create(
      pluginSceneResolvedActionToken,
      this,
      action
    )
  }

  reduce(
    state: WizDeepReadonly<TState>,
    input: WizStandardSchemaInput<TActionSchema>
  ): ReturnType<TReduce> | null {
    const resolvedAction = this.resolveAction(input)

    return resolvedAction === null
      ? null
      : this.reduceResolved(state, resolvedAction)
  }

  reduceResolved(
    state: WizDeepReadonly<TState>,
    resolvedAction: WizPluginSceneResolvedAction<
      WizStandardSchemaInput<TActionSchema>,
      WizStandardSchemaOutput<TActionSchema>
    >
  ): ReturnType<TReduce> | null {
    const action = getWizPluginSceneResolvedActionCanonical(
      resolvedAction,
      this
    )
    if (action === null) {
      return null
    }

    const result = this.#reduce(state, action)
    WizSceneResultFactory.assertAuthentic(result)
    const resultStateType = Object.getOwnPropertyDescriptor(
      result.state,
      "type"
    )?.value
    if (resultStateType !== this.type) {
      throw new TypeError(
        `Plugin scene "${this.type}" reducer returned state for scene "${String(resultStateType)}"`
      )
    }

    return result as ReturnType<TReduce>
  }

  enter(
    input: WizStandardSchemaInput<TNavigationSchema>
  ): WizPluginSceneNavigation<TState, TNavigationSchema> {
    return createPluginSceneNavigation(this, input)
  }

  getNavigationPayload(
    input: unknown
  ): WizDeepReadonly<WizStandardSchemaOutput<TNavigationSchema>> | null {
    return getSynchronousSchemaValue(this.#navigation.schema, input)
  }

  resolveNavigation(
    previousState: WizPluginSceneState,
    navigation: WizPluginSceneNavigation
  ): TState | WizPluginSceneNavigationRejectionReason | null {
    if (!ownedPluginSceneModules.has(this)) {
      return null
    }
    if (!this.#navigation.from.includes(previousState.type)) {
      return "TRANSITION_PLUGIN_SOURCE_NOT_ALLOWED"
    }
    const payload = getWizPluginSceneNavigationPayload<
      WizStandardSchemaOutput<TNavigationSchema>
    >(navigation, this)
    if (payload === null) {
      return "TRANSITION_PLUGIN_STATE_INVALID"
    }
    const state = this.#navigation.create(
      previousState.vault,
      payload as WizDeepReadonly<WizStandardSchemaOutput<TNavigationSchema>>
    )
    if (
      state.type !== this.type ||
      state.vault !== previousState.vault ||
      !WizImmutableValue.is(state) ||
      !Object.isFrozen(state)
    ) {
      return "TRANSITION_PLUGIN_STATE_INVALID"
    }
    pluginSceneModuleOwnership.ownImmutable(state)

    return state
  }
}

/**
 * registryがmoduleのconstructor token authorityを直接検証する内部境界。
 *
 * public `isOwned()` はown propertyでshadowできるため、registryでは使用しない。
 *
 * @internal
 */
export const isAuthenticWizPluginSceneModule = (
  module: unknown
): module is WizPluginSceneModule<
  WizPluginSceneState,
  WizStandardSchemaDefinition<unknown, WizPluginSceneAction>,
  WizStandardSchemaDefinition,
  (
    state: WizDeepReadonly<WizPluginSceneState>,
    action: WizDeepReadonly<WizPluginSceneAction>
  ) => unknown
> =>
  typeof module === "object" &&
  module !== null &&
  ownedPluginSceneModules.has(module)

Object.freeze(WizPluginSceneModule.prototype)

Object.freeze(WizPluginSceneModule)
