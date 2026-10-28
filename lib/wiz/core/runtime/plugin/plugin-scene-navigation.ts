import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WizPluginSceneState } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import type {
  WizStandardSchemaDefinition,
  WizStandardSchemaInput,
  WizStandardSchemaOutput,
} from "@/lib/wiz/core/standard-schema"
import { isWizPluginSceneNavigationForModule } from "@/lib/wiz/core/runtime/plugin/is-wiz-plugin-scene-navigation-for-module"
import { getWizPluginSceneNavigationPayload } from "@/lib/wiz/core/runtime/plugin/get-wiz-plugin-scene-navigation-payload"

export const pluginSceneNavigationToken = Symbol("WizPluginSceneNavigation")

export const ownedPluginSceneNavigations = new WeakSet<object>()

export const pluginSceneNavigationAuthorities = new WeakMap<
  object,
  Readonly<{
    module: object
    payload: unknown
  }>
>()

export type NavigationSource<
  TState extends WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition,
> = Readonly<{
  type: TState["type"]
  getNavigationPayload(
    input: unknown
  ): WizDeepReadonly<WizStandardSchemaOutput<TNavigationSchema>> | null
}>

export class WizPluginSceneNavigation<
  TState extends WizPluginSceneState = WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition =
    WizStandardSchemaDefinition,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "GO_TO_PLUGIN_SCENE"
  readonly sceneType: TState["type"]

  protected constructor(
    token: typeof pluginSceneNavigationToken,
    module: NavigationSource<TState, TNavigationSchema>,
    input: WizStandardSchemaInput<TNavigationSchema>
  ) {
    if (token !== pluginSceneNavigationToken) {
      throw new TypeError(
        "Plugin scene navigation must be created by its scene module"
      )
    }
    const payload = module.getNavigationPayload(input)
    if (payload === null) {
      throw new TypeError(
        `Invalid navigation payload for plugin scene "${module.type}"`
      )
    }

    this.sceneType = module.type
    pluginSceneNavigationAuthorities.set(
      this,
      Object.freeze({
        module,
        payload,
      })
    )
    ownedPluginSceneNavigations.add(this)
    WizImmutableValue.freeze(this)
  }

  belongsTo(module: object): boolean {
    return isWizPluginSceneNavigationForModule(this, module)
  }

  getPayload(module: object): unknown {
    return getWizPluginSceneNavigationPayload(this, module)
  }
}

Object.freeze(WizPluginSceneNavigation.prototype)

Object.freeze(WizPluginSceneNavigation)
