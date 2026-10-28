import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type {
  WizPluginSceneAction,
  WizPluginSceneState,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import type { WizPluginSceneNavigation } from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"
import { getWizPluginSceneResolvedActionCanonical } from "@/lib/wiz/core/runtime/plugin/get-wiz-plugin-scene-resolved-action-canonical"
import {
  isAuthenticWizPluginSceneModule,
  WizPluginSceneModule,
} from "@/lib/wiz/core/runtime/plugin/is-authentic-wiz-plugin-scene-module"
import type {
  WizPluginSceneModuleActionInput,
  WizPluginSceneModuleActionOutput,
  WizPluginSceneModuleEvent,
  WizPluginSceneModuleReason,
  WizPluginSceneModuleState,
  WizPluginSceneResolvedAction,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"
import type { WizPluginSceneNavigationRejectionReason } from "@/lib/wiz/core/runtime/plugin/is-authentic-wiz-plugin-scene-module"
import type { WizPluginSceneResult } from "@/lib/wiz/core/runtime/plugin/plugin-scene-result"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"

type PluginSceneModuleValue<TCandidate> =
  TCandidate extends WizPluginSceneModule<
    infer _TState,
    infer _TActionSchema,
    infer _TNavigationSchema,
    infer _TResult
  >
    ? TCandidate
    : never

type PluginSceneModuleTuple<TModules extends readonly unknown[]> = [
  TModules[number],
] extends [PluginSceneModuleValue<TModules[number]>]
  ? TModules
  : never

const pluginSceneRegistryToken = Symbol("WizPluginSceneRegistry")
const authenticPluginSceneRegistries = new WeakSet<object>()

export class WizPluginSceneRegistry<
  TState extends WizPluginSceneState = never,
  TActionInput = never,
  TActionOutput extends WizPluginSceneAction = never,
  TEvent = never,
  TReason extends string = never,
> {
  declare private readonly actionInputType: TActionInput
  declare private readonly actionOutputType: TActionOutput
  declare private readonly eventType: TEvent
  declare private readonly reasonType: TReason
  readonly #modules: readonly unknown[]
  readonly navigationSources: readonly Readonly<{
    sceneType: TState["type"]
    sourceTypes: readonly string[]
  }>[]
  readonly sceneTypes: readonly TState["type"][]

  private constructor(token: symbol, modules: readonly unknown[]) {
    if (token !== pluginSceneRegistryToken) {
      throw new TypeError("Plugin scene registry must be created with define()")
    }
    const sceneTypes: string[] = []
    for (const module of modules) {
      if (!isAuthenticWizPluginSceneModule(module)) {
        throw new TypeError(
          "Plugin scene registry accepts only WizPluginSceneModule values"
        )
      }
      if (sceneTypes.includes(module.type)) {
        throw new RangeError(`Duplicate plugin scene type "${module.type}"`)
      }
      sceneTypes.push(module.type)
    }

    this.#modules = Object.freeze([...modules])
    this.navigationSources = Object.freeze(
      modules.flatMap((module) =>
        isAuthenticWizPluginSceneModule(module)
          ? [
              Object.freeze({
                sceneType: module.type,
                sourceTypes: module.navigationSourceTypes,
              }),
            ]
          : []
      )
    ) as readonly Readonly<{
      sceneType: TState["type"]
      sourceTypes: readonly string[]
    }>[]
    this.sceneTypes = Object.freeze(sceneTypes) as readonly TState["type"][]
    authenticPluginSceneRegistries.add(this)
    Object.freeze(this)
  }

  static define<const TModules extends readonly unknown[]>(
    modules: PluginSceneModuleTuple<TModules>
  ): WizPluginSceneRegistry<
    WizPluginSceneModuleState<TModules[number]>,
    WizPluginSceneModuleActionInput<TModules[number]>,
    WizPluginSceneModuleActionOutput<TModules[number]>,
    WizPluginSceneModuleEvent<TModules[number]>,
    WizPluginSceneModuleReason<TModules[number]>
  > {
    return new WizPluginSceneRegistry(pluginSceneRegistryToken, modules)
  }

  /** @internal plugin composition boundary only. */
  static require(value: unknown, label: string): void {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticPluginSceneRegistries.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizPluginSceneRegistry.define()`
      )
    }
  }

  hasScene(sceneType: string): sceneType is TState["type"] {
    return this.sceneTypes.includes(sceneType)
  }

  acceptsAction(sceneType: string, input: unknown): boolean {
    const module = this.getModule(sceneType)

    return module?.acceptsAction(input) ?? false
  }

  acceptsAnyAction(input: unknown): boolean {
    for (const candidate of this.#modules) {
      if (
        isAuthenticWizPluginSceneModule(candidate) &&
        candidate.acceptsAction(input)
      ) {
        return true
      }
    }

    return false
  }

  resolveAction(
    sceneType: string,
    input: TActionInput
  ): WizPluginSceneResolvedAction<TActionInput, TActionOutput> | null {
    return this.resolveUnknownAction(sceneType, input)
  }

  /** @internal immutable world境界が所有済みのunknown inputをschemaで解決する。 */
  resolveUnknownAction(
    sceneType: string,
    input: unknown
  ): WizPluginSceneResolvedAction<TActionInput, TActionOutput> | null {
    const module = this.getModule(sceneType)
    if (module === null) {
      return null
    }

    return module.resolveAction(input) as WizPluginSceneResolvedAction<
      TActionInput,
      TActionOutput
    > | null
  }

  getCanonicalAction(
    sceneType: string,
    resolvedAction: WizPluginSceneResolvedAction<TActionInput, TActionOutput>
  ): WizDeepReadonly<TActionOutput> | null {
    const module = this.getModule(sceneType)
    if (module === null) {
      return null
    }

    return getWizPluginSceneResolvedActionCanonical(
      resolvedAction,
      module
    ) as WizDeepReadonly<TActionOutput> | null
  }

  reduce(
    state: TState,
    input: TActionInput
  ): WizPluginSceneResult<TState, TEvent, TReason> | null {
    const resolvedAction = this.resolveAction(state.type, input)
    if (resolvedAction === null) {
      return null
    }

    return this.reduceResolved(state, resolvedAction)
  }

  reduceResolved(
    state: TState,
    resolvedAction: WizPluginSceneResolvedAction<TActionInput, TActionOutput>
  ): WizPluginSceneResult<TState, TEvent, TReason> | null {
    const module = this.getModule(state.type)
    if (module === null) {
      return null
    }
    const result = module.reduceResolved(
      state,
      resolvedAction as WizPluginSceneResolvedAction<
        unknown,
        WizPluginSceneAction
      >
    )

    return result as WizPluginSceneResult<TState, TEvent, TReason> | null
  }

  resolveNavigation(
    previousState: WizPluginSceneState,
    navigation: WizPluginSceneNavigation
  ): TState | WizPluginSceneNavigationRejectionReason | null {
    const module = this.getModule(navigation.sceneType)
    if (module === null) {
      return null
    }
    const resolved = module.resolveNavigation(previousState, navigation)
    if (typeof resolved === "string" || resolved === null) {
      return resolved
    }

    return resolved as TState
  }

  private getModule(
    sceneType: string
  ): WizPluginSceneModule<
    WizPluginSceneState,
    WizStandardSchemaDefinition<unknown, WizPluginSceneAction>,
    WizStandardSchemaDefinition,
    (
      state: WizDeepReadonly<WizPluginSceneState>,
      action: WizDeepReadonly<WizPluginSceneAction>
    ) => unknown
  > | null {
    for (const candidate of this.#modules) {
      if (
        isAuthenticWizPluginSceneModule(candidate) &&
        candidate.type === sceneType
      ) {
        return candidate as WizPluginSceneModule<
          WizPluginSceneState,
          WizStandardSchemaDefinition<unknown, WizPluginSceneAction>,
          WizStandardSchemaDefinition,
          (
            state: WizDeepReadonly<WizPluginSceneState>,
            action: WizDeepReadonly<WizPluginSceneAction>
          ) => unknown
        >
      }
    }

    return null
  }
}

Object.freeze(WizPluginSceneRegistry.prototype)
Object.freeze(WizPluginSceneRegistry)

export type WizPluginSceneRegistryState<TRegistry> =
  TRegistry extends WizPluginSceneRegistry<
    infer TState,
    infer _TActionInput,
    infer _TActionOutput,
    infer _TEvent,
    infer _TReason
  >
    ? TState
    : never

export type WizPluginSceneRegistryActionInput<TRegistry> =
  TRegistry extends WizPluginSceneRegistry<
    infer _TState,
    infer TActionInput,
    infer _TActionOutput,
    infer _TEvent,
    infer _TReason
  >
    ? TActionInput
    : never

export type WizPluginSceneRegistryActionOutput<TRegistry> =
  TRegistry extends WizPluginSceneRegistry<
    infer _TState,
    infer _TActionInput,
    infer TActionOutput,
    infer _TEvent,
    infer _TReason
  >
    ? TActionOutput
    : never

export type WizPluginSceneRegistryEvent<TRegistry> =
  TRegistry extends WizPluginSceneRegistry<
    infer _TState,
    infer _TActionInput,
    infer _TActionOutput,
    infer TEvent,
    infer _TReason
  >
    ? TEvent
    : never

export type WizPluginSceneRegistryReason<TRegistry> =
  TRegistry extends WizPluginSceneRegistry<
    infer _TState,
    infer _TActionInput,
    infer _TActionOutput,
    infer _TEvent,
    infer TReason
  >
    ? TReason
    : never
