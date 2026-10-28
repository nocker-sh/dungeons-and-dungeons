import { describe, expect, it } from "vite-plus/test"
import {
  WizContentCatalog,
  WizContentCatalogCategoryNotFoundError,
  WizContentCatalogEntryNotFoundError,
  WizContentCatalogReferenceRule,
  WizContentCatalogReferenceRules,
  WizContentCatalogReferenceValidationError,
  WizContentCatalogValidationError,
} from "@/lib/wiz/core/content/wiz-content-catalog"
import { WizStandardSchemaValidationError } from "@/lib/wiz/core/standard-schema"
import {
  WizWorld,
  WizWorldCompositionError,
  WizWorldEnvironment,
  WizWorldEnvironmentValueError,
  WizWorldEventReaction,
  WizWorldModule,
  WizWorldReactionPolicy,
  WizWorldValueOwnershipError,
} from "@/lib/wiz/core/world/world"
import { WizWorldRules } from "@/lib/wiz/core/world/world-rules"
import {
  WizWorldSaveContentVersionError,
  WizWorldSaveSchemaVersionError,
  WizWorldSaveSerializationError,
} from "@/lib/wiz/core/save/world-save-codec"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"
import { WizEngineBattleContentError } from "@/lib/wiz/core/engine/battle/content"
import { WizEngineBattleDamageResult } from "@/lib/wiz/core/engine/damage/damage-result"
import { WizEngineBattleFleeResult } from "@/lib/wiz/core/engine/flee/flee-result"
import { WizIdGenerator } from "@/lib/wiz/core/services/wiz-id-generator"
import { WizPresetValidationError } from "@/lib/wiz/core/presets/assert-valid-wiz-preset"
import { WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import { WizRpgBattleModel } from "@/lib/wiz/core/rpg/battle-model"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WorldContentValidationError } from "@/lib/wiz/core/content/diagnostic"
import { WorldSnapshotReconcileError } from "@/lib/wiz/core/content/reconcile-snapshot"
import { WorldSnapshotValidationError } from "@/lib/wiz/core/content/snapshot-rules"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"
import { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"
import {
  WizAbility,
  WizAbilityBook,
  WizAbilityCatalog,
  WizAbilityLoadout,
  WizAbilityNotReadyError,
  WizAbilityReadiness,
} from "@/lib/wiz/core/domain/values/ability"
import {
  WizAbilityActivation,
  WizAbilityExecutionAccepted,
  WizAbilityExecutionRejected,
  WizAbilityExecutor,
} from "@/lib/wiz/core/domain/services/ability-executor"
import { WizAttributeSet } from "@/lib/wiz/core/domain/values/attribute-set"
import {
  WizEffect,
  WizEffectSet,
} from "@/lib/wiz/core/domain/values/effect-set"
import { WizEffectResistanceSet } from "@/lib/wiz/core/domain/values/effect-resistance-set"
import {
  WizEquipmentLoadout,
  WizInventory,
  WizInventoryEntry,
  WizInventoryOperationError,
} from "@/lib/wiz/core/domain/values/inventory"
import {
  WizInventoryRules,
  WizInventoryTransaction,
  WizInventoryTransactionError,
  WizInventoryTransfer,
} from "@/lib/wiz/core/domain/services/inventory-transaction"
import {
  WizItem,
  WizItemCatalog,
  WizItemWithEffect,
} from "@/lib/wiz/core/domain/values/item"
import {
  WizModifier,
  WizModifierSet,
} from "@/lib/wiz/core/domain/values/modifier-set"
import { WizQuestObjectiveProgress } from "@/lib/wiz/core/domain/values/quest-objective-progress"
import { WizRankProgression } from "@/lib/wiz/core/domain/values/rank-progression"
import {
  WizResourceOperationError,
  WizResourceSet,
} from "@/lib/wiz/core/domain/values/resource-set"
import {
  WizWallet,
  WizWalletOperationError,
} from "@/lib/wiz/core/domain/values/wallet"
import {
  createWizStandardHungerService,
  WizVaultHungerService,
} from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"
import { WizEngineExplorationEventReward } from "@/lib/wiz/core/engine/exploration/event-reward"
import { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import { WizEngineTimeFactory } from "@/lib/wiz/core/engine/time/wiz-time-factory"
import { WizPluginSceneModule } from "@/lib/wiz/core/runtime/plugin/is-authentic-wiz-plugin-scene-module"
import { WizPluginSceneRegistry } from "@/lib/wiz/core/runtime/plugin/plugin-scene-registry"
import { WizRpgEquipmentRules } from "@/lib/wiz/core/rpg/equipment-rules"
import { WizRpgScenes } from "@/lib/wiz/core/rpg/scenes"
import { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import { WizStandardPluginSceneCodec } from "@/lib/wiz/core/presets/standard-session"
import { WizEngineMessageFormatter } from "@/lib/wiz/core/engine/message/wiz-message-formatter"
import { WizExplorationPresentationJa } from "@/lib/wiz/core/presets/exploration-presentation-ja"
import { WizQuestPresentationJa } from "@/lib/wiz/core/presets/quest-presentation-ja"
import {
  WizRpgAffordance,
  WizRpgFeature,
  WizRpgFeatureCodec,
} from "@/lib/wiz/core/rpg/feature"
import {
  WizRpgCommands,
  WizRpgFeatureAction,
} from "@/lib/wiz/core/rpg/commands"
import { WizRpgComponentIdentity } from "@/lib/wiz/core/rpg/component-identity"
import {
  WizRpgCompositionComponent,
  WizRpgCompositionManifest,
} from "@/lib/wiz/core/rpg/composition-manifest"
import { WizRpgWorldIdentity } from "@/lib/wiz/core/rpg/world-identity"
import {
  WizRpgDispatchResult,
  WizRpgEventRecord,
  WizRpgWorld,
} from "@/lib/wiz/core/rpg/world"
import { WizRpgPolicy } from "@/lib/wiz/core/rpg/policy"
import { WizRpgSceneState } from "@/lib/wiz/core/rpg/scene-state"
import { WizRpgSceneRuntime } from "@/lib/wiz/core/rpg/scene-runtime"
import { WizRpgWorldDefinition } from "@/lib/wiz/core/rpg/standard-world"
import { WizRpgWorldState } from "@/lib/wiz/core/rpg/world-state"

const EXPORTED_CLASSES = Object.freeze([
  WizContentCatalog,
  WizContentCatalogCategoryNotFoundError,
  WizContentCatalogEntryNotFoundError,
  WizContentCatalogReferenceRule,
  WizContentCatalogReferenceRules,
  WizContentCatalogReferenceValidationError,
  WizContentCatalogValidationError,
  WizStandardSchemaValidationError,
  WizWorld,
  WizWorldCompositionError,
  WizWorldEnvironment,
  WizWorldEnvironmentValueError,
  WizWorldEventReaction,
  WizWorldModule,
  WizWorldReactionPolicy,
  WizWorldRules,
  WizWorldSaveContentVersionError,
  WizWorldSaveSchemaVersionError,
  WizWorldSaveSerializationError,
  WizWorldValueOwnershipError,
  WorldContent,
  WorldContentValidationError,
  WorldSnapshotReconcileError,
  WorldSnapshotValidationError,
  WizAbility,
  WizAbilityActivation,
  WizAbilityBook,
  WizAbilityCatalog,
  WizAbilityExecutionAccepted,
  WizAbilityExecutionRejected,
  WizAbilityExecutor,
  WizAbilityLoadout,
  WizAbilityNotReadyError,
  WizAbilityReadiness,
  WizAttributeSet,
  WizEffect,
  WizEffectResistanceSet,
  WizEffectSet,
  WizEquipmentLoadout,
  WizInventory,
  WizInventoryEntry,
  WizInventoryOperationError,
  WizInventoryRules,
  WizInventoryTransaction,
  WizInventoryTransactionError,
  WizInventoryTransfer,
  WizItem,
  WizItemCatalog,
  WizItemWithEffect,
  WizModifier,
  WizModifierSet,
  WizQuestObjectiveProgress,
  WizRankProgression,
  WizResourceOperationError,
  WizResourceSet,
  WizWallet,
  WizWalletOperationError,
  WizDice,
  WizEngineBattleActionBuilder,
  WizEngineBattleContentError,
  WizEngineBattleDamageResult,
  WizEngineBattleFleeResult,
  WizEngineExplorationEventReward,
  WizEngineMessageFormatter,
  WizEngineShopDialogueService,
  WizEngineTimeFactory,
  WizExplorationPresentationJa,
  WizIdGenerator,
  WizPresetValidationError,
  WizPresetValue,
  WizPluginSceneModule,
  WizPluginSceneRegistry,
  WizQuestPresentationJa,
  WizRpgAffordance,
  WizRpgBattleModel,
  WizRpgCommands,
  WizRpgComponentIdentity,
  WizRpgCompositionComponent,
  WizRpgCompositionManifest,
  WizRpgWorldIdentity,
  WizRpgDispatchResult,
  WizRpgEquipmentRules,
  WizStandardInventoryService,
  WizRpgEventRecord,
  WizRpgFeature,
  WizRpgFeatureAction,
  WizRpgFeatureCodec,
  WizRpgPolicy,
  WizRpgSceneState,
  WizRpgSceneRuntime,
  WizRpgScenes,
  WizRpgWorld,
  WizRpgWorldDefinition,
  WizRpgWorldState,
  WizStandardPluginSceneCodec,
  WizValueValidationError,
  WizVaultHungerService,
  WizVaultPlayer,
])

describe("public class immutability", () => {
  it("公開constructorとprototypeをすべて凍結する", () => {
    const mutableSurfaces = EXPORTED_CLASSES.flatMap((ExportedClass) => [
      ...(Object.isFrozen(ExportedClass)
        ? []
        : [`${ExportedClass.name}.constructor`]),
      ...(Object.isFrozen(ExportedClass.prototype)
        ? []
        : [`${ExportedClass.name}.prototype`]),
    ])

    expect(EXPORTED_CLASSES).toHaveLength(98)
    expect(new Set(EXPORTED_CLASSES).size).toBe(98)
    expect(mutableSurfaces).toEqual([])
  })

  it("主要factoryとserviceのinstance不変性を維持する", () => {
    const environment = WizWorldEnvironment.create({
      nextId: () => "id",
      now: () => 0,
      random: () => 0,
    })
    const inventoryService = new WizStandardInventoryService(() => "entry")
    const instances = Object.freeze([
      environment,
      WizWorld.create({ count: 0 }, environment),
      WizWorldReactionPolicy.create(),
      WizWorldRules.forState<Readonly<{ count: number }>>(),
      WizPresetValue.create(),
      WizDice.fixed([1]),
      WizIdGenerator.fixed("id"),
      new WizEngineBattleActionBuilder({ nextId: () => "id" }),
      new WizEngineBattleDamageResult({
        damage: 0,
        elementalModifier: 1,
        hitCount: 0,
        isBlocked: false,
        isCritical: false,
        isEvaded: false,
      }),
      new WizEngineBattleFleeResult({
        canRetry: true,
        success: false,
      }),
      new WizEngineExplorationEventReward(inventoryService),
      inventoryService,
      new WizEngineTimeFactory({ random: () => 0 }),
      createWizStandardHungerService(),
    ])

    expect(instances.every((instance) => Object.isFrozen(instance))).toBe(true)
  })
})
