import type { WizPluginSceneState } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import type {
  WizStandardSchemaDefinition,
  WizStandardSchemaInput,
} from "@/lib/wiz/core/standard-schema"
import {
  WizPluginSceneNavigation,
  pluginSceneNavigationToken,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"
import type { NavigationSource } from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"

export class OwnedPluginSceneNavigation<
  TState extends WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition,
> extends WizPluginSceneNavigation<TState, TNavigationSchema> {
  constructor(
    module: NavigationSource<TState, TNavigationSchema>,
    input: WizStandardSchemaInput<TNavigationSchema>
  ) {
    super(pluginSceneNavigationToken, module, input)
  }
}

export const createPluginSceneNavigation = <
  TState extends WizPluginSceneState,
  TNavigationSchema extends WizStandardSchemaDefinition,
>(
  module: NavigationSource<TState, TNavigationSchema>,
  input: WizStandardSchemaInput<TNavigationSchema>
): WizPluginSceneNavigation<TState, TNavigationSchema> =>
  new OwnedPluginSceneNavigation(module, input)

Object.freeze(OwnedPluginSceneNavigation.prototype)

Object.freeze(OwnedPluginSceneNavigation)
