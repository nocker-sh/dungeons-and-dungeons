import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WizPluginSceneAction } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import {
  WizPluginSceneResolvedAction,
  ownedPluginSceneResolvedActions,
  pluginSceneResolvedActionAuthorities,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"

/**
 * resolved actionのschema出力を、method dispatchを介さずidentity authorityから取得する。
 *
 * @internal
 */
export const getWizPluginSceneResolvedActionCanonical = <
  TInput,
  TOutput extends WizPluginSceneAction,
>(
  resolvedAction: WizPluginSceneResolvedAction<TInput, TOutput>,
  module: object
): WizDeepReadonly<TOutput> | null => {
  if (!ownedPluginSceneResolvedActions.has(resolvedAction)) {
    return null
  }
  const authority = pluginSceneResolvedActionAuthorities.get(resolvedAction)
  return authority?.module === module
    ? (authority.canonicalAction as WizDeepReadonly<TOutput>)
    : null
}
