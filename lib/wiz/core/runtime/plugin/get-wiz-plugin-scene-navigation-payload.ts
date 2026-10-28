import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { isWizPluginSceneNavigationForModule } from "@/lib/wiz/core/runtime/plugin/is-wiz-plugin-scene-navigation-for-module"
import { pluginSceneNavigationAuthorities } from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"

/**
 * schema検証済みpayloadをidentity authorityから直接取得する。
 *
 * @internal
 */
export const getWizPluginSceneNavigationPayload = <TOutput>(
  navigation: unknown,
  module: object
): WizDeepReadonly<TOutput> | null => {
  if (!isWizPluginSceneNavigationForModule(navigation, module)) {
    return null
  }
  return pluginSceneNavigationAuthorities.get(navigation)
    ?.payload as WizDeepReadonly<TOutput> | null
}
