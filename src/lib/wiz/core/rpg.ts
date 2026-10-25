/**
 * RPG composition rootの公開入口。
 *
 * content、battle、extension、presentationは対応するsubpathから選択して利用する。
 */
export { WizRpgWorldIdentity } from "./rpg/world-identity"
export type {
  WizRpgRuntimeIdentityComponentKind,
  WizRpgWorldIdentityComponentKind,
} from "./rpg/world-identity"
export { WizRpgComponentIdentity } from "./rpg/component-identity"
export { WizRpgCompositionComponent, WizRpgCompositionManifest } from "./rpg/composition-manifest"
export { WizRpgCommands, WizRpgFeatureAction } from "./rpg/commands"
export type { WizRpgFeatureCommands, WizRpgFeatureCommandSurface } from "./rpg/commands"
export { WizRpgAffordance, WizRpgFeature, WizRpgFeatureCodec } from "./rpg/feature"
export type {
  WizRpgAffordanceDefinition,
  WizRpgFeatureAcceptedResult,
  WizRpgFeatureCodecDefinition,
  WizRpgFeatureContext,
  WizRpgFeatureDefinition,
  WizRpgFeatureReactionContext,
  WizRpgFeatureRejectedResult,
  WizRpgFeatureResult,
} from "./rpg/feature"
export { WizRpgPolicy } from "./rpg/policy"
export type { WizRpgAuthorization, WizRpgPolicyDefinition } from "./rpg/policy"
export { WizRpgSceneRuntime } from "./rpg/scene-runtime"
export type { WizRpgSceneDispatchResult, WizRpgSceneRuntimeDefinition } from "./rpg/scene-runtime"
export { WizRpgSceneState } from "./rpg/scene-state"
export { WizRpgWorldDefinition } from "./rpg/standard-world"
export type { WizRpgStandardWorld } from "./rpg/standard-world"
export { WizRpgDispatchResult, WizRpgEventRecord, WizRpgWorld } from "./rpg/world"
export type { WizRpgDispatchError, WizRpgEventSource } from "./rpg/world"
export { WizRpgWorldState } from "./rpg/world-state"
export type { WizRpgFeatureStates } from "./rpg/world-state"
