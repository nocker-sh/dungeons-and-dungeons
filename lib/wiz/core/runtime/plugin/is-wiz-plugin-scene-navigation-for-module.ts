import {
  WizPluginSceneNavigation,
  ownedPluginSceneNavigations,
  pluginSceneNavigationAuthorities,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"

/**
 * plugin moduleだけがnavigationのidentity authorityを検証する内部境界。
 *
 * public methodはown propertyでshadowできるため、authority判定では呼び出さない。
 *
 * @internal
 */
export const isWizPluginSceneNavigationForModule = (
  navigation: unknown,
  module: object
): navigation is WizPluginSceneNavigation =>
  typeof navigation === "object" &&
  navigation !== null &&
  ownedPluginSceneNavigations.has(navigation) &&
  pluginSceneNavigationAuthorities.get(navigation)?.module === module
