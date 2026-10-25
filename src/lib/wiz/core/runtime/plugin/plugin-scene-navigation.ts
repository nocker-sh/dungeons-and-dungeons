import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizPluginSceneState } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import type {
  WizStandardSchemaDefinition,
  WizStandardSchemaInput,
  WizStandardSchemaOutput,
} from "@/lib/wiz/core/standard-schema"

const pluginSceneNavigationToken = Symbol("WizPluginSceneNavigation")
const ownedPluginSceneNavigations = new WeakSet<object>()
const pluginSceneNavigationAuthorities = new WeakMap<
  object,
  Readonly<{
    module: object
    payload: unknown
  }>
>()

type NavigationSource<
  TState extends WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition,
> = Readonly<{
  type: TState["type"]
  getNavigationPayload(
    input: unknown,
  ): WizDeepReadonly<WizStandardSchemaOutput<TNavigationSchema>> | null
}>

export class WizPluginSceneNavigation<
  TState extends WizPluginSceneState = WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition = WizStandardSchemaDefinition,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "GO_TO_PLUGIN_SCENE"
  readonly sceneType: TState["type"]

  protected constructor(
    token: typeof pluginSceneNavigationToken,
    module: NavigationSource<TState, TNavigationSchema>,
    input: WizStandardSchemaInput<TNavigationSchema>,
  ) {
    if (token !== pluginSceneNavigationToken) {
      throw new TypeError("Plugin scene navigation must be created by its scene module")
    }
    const payload = module.getNavigationPayload(input)
    if (payload === null) {
      throw new TypeError(`Invalid navigation payload for plugin scene "${module.type}"`)
    }

    this.sceneType = module.type
    pluginSceneNavigationAuthorities.set(
      this,
      Object.freeze({
        module,
        payload,
      }),
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

class OwnedPluginSceneNavigation<
  TState extends WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition,
> extends WizPluginSceneNavigation<TState, TNavigationSchema> {
  constructor(
    module: NavigationSource<TState, TNavigationSchema>,
    input: WizStandardSchemaInput<TNavigationSchema>,
  ) {
    super(pluginSceneNavigationToken, module, input)
  }
}

export const createPluginSceneNavigation = <
  TState extends WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition,
>(
  module: NavigationSource<TState, TNavigationSchema>,
  input: WizStandardSchemaInput<TNavigationSchema>,
): WizPluginSceneNavigation<TState, TNavigationSchema> =>
  new OwnedPluginSceneNavigation(module, input)

/**
 * plugin moduleだけがnavigationのidentity authorityを検証する内部境界。
 *
 * public methodはown propertyでshadowできるため、authority判定では呼び出さない。
 *
 * @internal
 */
export const isWizPluginSceneNavigationForModule = (
  navigation: unknown,
  module: object,
): navigation is WizPluginSceneNavigation =>
  typeof navigation === "object" &&
  navigation !== null &&
  ownedPluginSceneNavigations.has(navigation) &&
  pluginSceneNavigationAuthorities.get(navigation)?.module === module

/**
 * schema検証済みpayloadをidentity authorityから直接取得する。
 *
 * @internal
 */
export const getWizPluginSceneNavigationPayload = <TOutput>(
  navigation: unknown,
  module: object,
): WizDeepReadonly<TOutput> | null => {
  if (!isWizPluginSceneNavigationForModule(navigation, module)) {
    return null
  }
  return pluginSceneNavigationAuthorities.get(navigation)
    ?.payload as WizDeepReadonly<TOutput> | null
}

Object.freeze(WizPluginSceneNavigation.prototype)
Object.freeze(WizPluginSceneNavigation)
Object.freeze(OwnedPluginSceneNavigation.prototype)
Object.freeze(OwnedPluginSceneNavigation)
