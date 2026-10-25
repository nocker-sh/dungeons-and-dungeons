import { z } from "zod"
import type { WizContentShopProducts } from "@/lib/wiz/core/definition/shop/dialogue"
import { zWizContentConsumableEffectType } from "@/lib/wiz/core/definition/item/consumable-effect"
import {
  DEFAULT_EFFECT_CONFIG,
  type WizEffectConfig,
} from "@/lib/wiz/core/config/battle/wiz-effect-config"
import { DEFAULT_LEVEL_UP_CONFIG } from "@/lib/wiz/core/config/level-up/wiz-level-up-config"
import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"
import { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { WizEffect, WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import type { WizEngineBattleContentResolver } from "@/lib/wiz/core/engine/battle/content"
import { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import {
  createBattleEffect,
  getBattleAbilityEffectId,
  getBattleEffectInitialTurns,
  type WizBattleEffectSource,
} from "@/lib/wiz/core/engine/battle/effects"
import { resolveCanonicalBattleAction } from "@/lib/wiz/core/engine/battle/execution/action-validation"
import { getBattleItemBuff } from "@/lib/wiz/core/engine/battle/item"
import { WizEngineBattlePhaseDefeat } from "@/lib/wiz/core/engine/battle/phases/defeat"
import { WizEngineBattleEncounter } from "@/lib/wiz/core/engine/battle/phases/encounter"
import { WizEngineBattlePhaseTurnOrder } from "@/lib/wiz/core/engine/battle/phases/turn-order"
import { WizEngineBattlePhaseVictory } from "@/lib/wiz/core/engine/battle/phases/victory"
import { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import type { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import {
  type WizDeepReadonly,
  type WizImmutableValueContract,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import {
  WizSceneBattleCharacterAdapter,
  type WizSceneBattleCharacterAuthority,
} from "@/lib/wiz/core/runtime/converters/battle-character-adapter"
import {
  WizSceneBattleMonsterAdapter,
  type WizSceneBattleMonsterAuthority,
} from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import type {
  WizPluginSceneAction,
  WizPluginSceneState,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import { WizStandardSceneName } from "@/lib/wiz/core/runtime/standard-scene-name"
import { WizStateBattle } from "@/lib/wiz/core/runtime/scenes/battle/state"
import {
  WizConversationProgress,
  WizStateConversation,
  type WizConversationProgressData,
} from "@/lib/wiz/core/runtime/scenes/conversation/state"
import type { WizConversationTranscriptEntry } from "@/lib/wiz/core/runtime/scenes/conversation/types"
import {
  WizStateCrafting,
  type WizSceneCraftingMessage,
} from "@/lib/wiz/core/runtime/scenes/crafting/state"
import {
  WizStateExploration,
  type WizSceneExplorationEventProgress,
  type WizSceneExplorationMessage,
} from "@/lib/wiz/core/runtime/scenes/exploration/states/state"
import { WizStateInn, type WizSceneInnMessage } from "@/lib/wiz/core/runtime/scenes/inn/state"
import { WizStateLevelUp } from "@/lib/wiz/core/runtime/scenes/level-up/state"
import { WizStateQuest, type WizSceneQuestMessage } from "@/lib/wiz/core/runtime/scenes/quest/state"
import {
  WizStateShop,
  type WizSceneShopConversation,
  type WizSceneShopMessage,
} from "@/lib/wiz/core/runtime/scenes/shop/state"
import { WizStateVillage } from "@/lib/wiz/core/runtime/scenes/village/state"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import {
  WizWorldSaveCodec,
  type WizWorldSaveEnvelope,
  WizWorldSaveJsonOwnership,
} from "@/lib/wiz/core/save/world-save-codec"
import {
  WorldSnapshot,
  type WorldSnapshotCanonicalData,
  type WorldSnapshotData,
  zWorldSnapshotData,
} from "@/lib/wiz/core/save/world-snapshot"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  WizStandardSchema,
  type WizStandardSchemaDefinition,
  type WizStandardSchemaInput,
  type WizStandardSchemaOutput,
} from "@/lib/wiz/core/standard-schema"
import type { WizSkillCheckResult } from "@/lib/wiz/core/types"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import { WizVaultEventStateSchema } from "@/lib/wiz/core/vault/states/event/schema"
import type { WizContentRecipe } from "@/lib/wiz/core/definition/recipe/recipe"

const sessionOwnership = new WizObjectService()
const pluginSceneOwnership = new WizObjectService()
const standardSessionConstructionToken = Symbol("WizStandardSessionConstruction")
const restoreStandardSessionScene = Symbol("WizStandardSessionCodec.restoreScene")
const captureValidatedPluginScene = Symbol("WizStandardPluginSceneCodec.captureValidated")
const restoreCapturedPluginScene = Symbol("WizStandardPluginSceneCodec.restoreCaptured")
const captureValidatedRewardCustom = Symbol("WizStandardRewardCustomCodec.captureValidated")
const authenticPluginSceneCodecs = new WeakSet<object>()
const authenticRewardCustomCodecs = new WeakSet<object>()
const authenticStandardSessionSnapshots = new WeakSet<object>()
const standardSessionSnapshotOwners = new WeakMap<object, object>()
const canonicalStandardSessionScenes = new WeakMap<object, object>()

const assertStandardSessionConstructionToken = (token: symbol): void => {
  if (token !== standardSessionConstructionToken) {
    throw new TypeError("Standard session values must be created by their public factories")
  }
}

const assertAuthenticStandardSessionSnapshot = (snapshot: object): void => {
  if (!authenticStandardSessionSnapshots.has(snapshot)) {
    throw new TypeError("Standard session snapshot was not created by its session codec")
  }
}

const assertStandardSessionSnapshotOwner = (snapshot: object, owner: object): void => {
  assertAuthenticStandardSessionSnapshot(snapshot)
  if (standardSessionSnapshotOwners.get(snapshot) !== owner) {
    throw new TypeError("Standard session snapshot belongs to a different session codec")
  }
}

declare const pluginSceneStateType: unique symbol
declare const pluginSceneInputType: unique symbol
declare const pluginSceneOutputType: unique symbol
declare const pluginSceneContentType: unique symbol
declare const rewardCustomType: unique symbol
declare const rewardCustomInputType: unique symbol

type WizStandardValidatedCapture<TInput, TOutput> = Readonly<{
  wire: WizDeepReadonly<TInput>
  canonical: WizDeepReadonly<TOutput>
}>

export const WIZ_STANDARD_SESSION_SCHEMA_VERSION = 1

const zFiniteNumber = z.number().finite()
const zIndex = z.number().int().nonnegative()
const zIdentifier = z.string().min(1)
const zJsonPayload = z.unknown()
const zUndefinedRewardCustom = z.undefined()
const zShopProductType = z.enum(["item", "weapon", "armor"])

const zShopPurchaseRejection = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("invalid_price"),
    price: zFiniteNumber,
  }),
  z.strictObject({
    type: z.literal("insufficient_gold"),
    required: zFiniteNumber,
    available: zFiniteNumber,
    shortfall: zFiniteNumber,
  }),
  z.strictObject({
    type: z.literal("unknown_product"),
    productType: zShopProductType,
    productId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("product_not_sold"),
    shopId: zIdentifier,
    productType: zShopProductType,
    productId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("no_pending_purchase"),
  }),
])

const zShopSaleRejection = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("unknown_item"),
    itemId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("item_not_owned"),
    itemId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("invalid_price"),
    itemId: zIdentifier,
    price: zFiniteNumber,
  }),
])

const zShopConversationRejection = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("dialogue_not_found"),
    shopId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("topic_not_found"),
    shopId: zIdentifier,
    topicId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("topic_has_no_lines"),
    shopId: zIdentifier,
    topicId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("no_active_conversation"),
  }),
])

const zShopPurchaseMessageFields = {
  productType: zShopProductType,
  productId: zIdentifier,
  price: zFiniteNumber,
} as const

const zShopMessage: z.ZodType<WizSceneShopMessage> = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("purchase_prompt"),
    ...zShopPurchaseMessageFields,
  }),
  z.strictObject({
    type: z.literal("purchase_completed"),
    ...zShopPurchaseMessageFields,
  }),
  z.strictObject({
    type: z.literal("purchase_cancelled"),
  }),
  z.strictObject({
    type: z.literal("purchase_rejected"),
    rejection: zShopPurchaseRejection,
  }),
  z.strictObject({
    type: z.literal("sale_completed"),
    itemId: zIdentifier,
    price: zFiniteNumber,
  }),
  z.strictObject({
    type: z.literal("sale_rejected"),
    rejection: zShopSaleRejection,
  }),
  z.strictObject({
    type: z.literal("conversation_ended"),
  }),
  z.strictObject({
    type: z.literal("conversation_rejected"),
    rejection: zShopConversationRejection,
  }),
])

const zInnStayRejection = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("unknown_plan"),
    planId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("insufficient_gold"),
    planId: zIdentifier,
    required: zFiniteNumber,
    available: zFiniteNumber,
    shortfall: zFiniteNumber,
  }),
  z.strictObject({
    type: z.literal("no_plan_selected"),
  }),
])

const zInnMessage: z.ZodType<WizSceneInnMessage> = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("stay_rejected"),
    rejection: zInnStayRejection,
  }),
])

const zItemEffectRejection = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("missing_effect") }),
  z.strictObject({ type: z.literal("target_not_defeated") }),
  z.strictObject({
    type: z.literal("no_change"),
    effectType: z.enum(["heal", "restore_mp", "food", "revive"]),
  }),
  z.strictObject({
    type: z.literal("unsupported_effect"),
    effectType: zWizContentConsumableEffectType,
    target: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("context_required"),
    effectType: z.enum(["damage", "escape"]),
    context: z.literal("battle"),
  }),
  z.strictObject({
    type: z.literal("invalid_value"),
    effectType: zWizContentConsumableEffectType,
    field: zIdentifier,
    value: z.string().min(1),
  }),
])

const zExplorationMessage: z.ZodType<WizSceneExplorationMessage> = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("event_encountered"),
      eventId: zIdentifier,
    }),
    z.strictObject({
      type: z.literal("items_gathered"),
      areaId: zIdentifier,
      itemIds: z.array(zIdentifier),
    }),
    z.strictObject({
      type: z.literal("gather_rejected"),
      areaId: zIdentifier,
      reason: z.enum(["nothing_available", "environment"]),
    }),
    z.strictObject({
      type: z.literal("action_rejected"),
      action: z.enum(["explore", "gather", "hunt", "rest"]),
      areaId: zIdentifier,
      reason: z.enum([
        "area_not_found",
        "not_enough_ap",
        "no_targets_available",
        "random_selection_failed",
        "content_not_found",
        "already_rested",
      ]),
      referenceId: zIdentifier.optional(),
    }),
    z.strictObject({
      type: z.literal("event_choice_rejected"),
      reason: z.enum(["event_not_active", "choice_not_found"]),
      choiceIndex: zIndex,
    }),
    z.strictObject({
      type: z.literal("event_roll_rejected"),
      reason: z.enum(["event_not_active", "choice_not_selected", "choice_not_found"]),
      choiceIndex: zIndex.optional(),
    }),
    z.strictObject({
      type: z.literal("food_rejected"),
      itemId: zIdentifier,
      reason: z.enum(["item_not_found", "not_food", "not_owned", "effect_rejected"]),
      effectRejection: zItemEffectRejection.optional(),
    }),
  ])
  .superRefine((message, context) => {
    if (
      message.type === "action_rejected" &&
      message.reason === "content_not_found" &&
      message.referenceId === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "content_not_found requires referenceId",
        path: ["referenceId"],
      })
    }
    if (
      message.type === "event_roll_rejected" &&
      message.reason === "choice_not_found" &&
      message.choiceIndex === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "choice_not_found requires choiceIndex",
        path: ["choiceIndex"],
      })
    }
    if (
      message.type === "food_rejected" &&
      message.reason === "effect_rejected" &&
      message.effectRejection === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "effect_rejected requires effectRejection",
        path: ["effectRejection"],
      })
    }
  })

const zCraftingMessage: z.ZodType<WizSceneCraftingMessage> = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("missing_facility"),
    recipeId: zIdentifier,
    facilityId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("missing_materials"),
    recipeId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("craft_succeeded"),
    recipeId: zIdentifier,
    quality: z.enum(["normal", "high"]),
  }),
  z.strictObject({
    type: z.literal("craft_failed"),
    recipeId: zIdentifier,
    materialsLost: zFiniteNumber,
  }),
])

const zQuestCompletionRejection = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("no_selection") }),
  z.strictObject({
    type: z.literal("quest_not_found"),
    questId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("quest_not_accepted"),
    questId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("quest_already_completed"),
    questId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("objective_target_not_found"),
    questId: zIdentifier,
    objectiveType: z.literal("explore"),
    targetId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("objective_incomplete"),
    questId: zIdentifier,
    objectiveType: z.enum(["defeat", "gather", "explore", "deliver"]),
    targetId: zIdentifier,
    current: zFiniteNumber,
    required: zFiniteNumber,
  }),
])

const zQuestMessage: z.ZodType<WizSceneQuestMessage> = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("quest_selection_rejected"),
      questId: zIdentifier,
      reason: z.literal("quest_not_found"),
    }),
    z.strictObject({
      type: z.literal("quest_accepted"),
      questId: zIdentifier,
    }),
    z.strictObject({
      type: z.literal("quest_acceptance_rejected"),
      questId: zIdentifier.optional(),
      reason: z.enum(["no_selection", "already_accepted", "already_completed"]),
    }),
    z.strictObject({
      type: z.literal("quest_completed"),
      questId: zIdentifier,
      reward: z.strictObject({
        gold: zFiniteNumber,
        exp: zFiniteNumber,
        affinityBonus: zFiniteNumber,
      }),
    }),
    z.strictObject({
      type: z.literal("quest_completion_rejected"),
      rejection: zQuestCompletionRejection,
    }),
  ])
  .superRefine((message, context) => {
    if (
      message.type === "quest_acceptance_rejected" &&
      message.reason !== "no_selection" &&
      message.questId === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: `${message.reason} requires questId`,
        path: ["questId"],
      })
    }
  })

const zSkillCheckResult = z.strictObject({
  dice: z.tuple([zFiniteNumber, zFiniteNumber]),
  total: zFiniteNumber,
  modifier: zFiniteNumber,
  targetNumber: zFiniteNumber,
  success: z.boolean(),
  critical: z.boolean(),
  fumble: z.boolean(),
})

const zConversationTranscriptEntry = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("dialogue_started"),
    dialogueId: zIdentifier,
  }),
  z.strictObject({
    type: z.literal("dialogue_line"),
    dialogueId: zIdentifier,
    lineIndex: zIndex,
  }),
  z.strictObject({
    type: z.literal("dialogue_completed"),
    dialogueId: zIdentifier,
    affinityDelta: zFiniteNumber,
  }),
  z.strictObject({
    type: z.literal("option_selected"),
    dialogueId: zIdentifier,
    optionId: zIdentifier,
    affinityDelta: zFiniteNumber,
  }),
  z.strictObject({
    type: z.literal("gift_applied"),
    itemId: zIdentifier,
    reaction: z.enum(["love", "neutral", "dislike"]),
    affinityDelta: zFiniteNumber,
  }),
])

const zShopPurchase = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("item"), itemId: zIdentifier, price: zFiniteNumber }),
  z.strictObject({ type: z.literal("weapon"), weaponId: zIdentifier, price: zFiniteNumber }),
  z.strictObject({ type: z.literal("armor"), armorId: zIdentifier, price: zFiniteNumber }),
])

const zShopConversationReference = z.strictObject({
  topicId: zIdentifier,
  currentIndex: zIndex,
  displayedLineCount: zIndex,
})

const zVillageSceneSnapshot = z.strictObject({
  type: z.literal("village"),
  selectedAction: z.enum(["explore", "shop", "quest", "talk", "home", "inn"]).nullable(),
})

const zShopSceneSnapshot = z.strictObject({
  type: z.literal("shop"),
  shopId: zIdentifier,
  buyPriceModifier: zFiniteNumber,
  pendingPurchase: zShopPurchase.nullable(),
  message: zShopMessage.nullable(),
  conversation: zShopConversationReference.nullable(),
  lastConversation: zShopConversationReference.nullable(),
})

const zInnSceneSnapshot = z.strictObject({
  type: z.literal("inn"),
  selectedPlan: zIdentifier.nullable(),
  confirmingStay: z.boolean(),
  message: zInnMessage.nullable(),
})

const zExplorationEventProgress = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("none") }),
  z.strictObject({
    status: z.literal("encounter"),
    eventId: zIdentifier,
    choiceIndex: zIndex.nullable(),
  }),
  z.strictObject({
    status: z.literal("rolling"),
    eventId: zIdentifier,
    choiceIndex: zIndex,
  }),
  z.strictObject({
    status: z.literal("result"),
    eventId: zIdentifier,
    choiceIndex: zIndex,
    diceResult: zSkillCheckResult,
  }),
])

const zExplorationSceneSnapshot = z.strictObject({
  type: z.literal("exploration"),
  areaId: zIdentifier,
  eventProgress: zExplorationEventProgress,
  message: zExplorationMessage.nullable(),
})

const zConversationProgress = z.discriminatedUnion("phase", [
  z.strictObject({
    phase: z.literal("idle"),
    dialogueId: z.null(),
    nextLineIndex: z.literal(0),
  }),
  z.strictObject({
    phase: z.literal("reading"),
    dialogueId: zIdentifier,
    nextLineIndex: zIndex,
  }),
  z.strictObject({
    phase: z.literal("choosing"),
    dialogueId: zIdentifier,
    nextLineIndex: zIndex,
  }),
  z.strictObject({
    phase: z.literal("ready_to_complete"),
    dialogueId: zIdentifier,
    nextLineIndex: zIndex,
  }),
  z.strictObject({
    phase: z.literal("completed"),
    dialogueId: zIdentifier,
    nextLineIndex: zIndex,
    completion: z.strictObject({
      transcriptIndex: zIndex,
    }),
  }),
])

const zConversationSceneSnapshot = z
  .strictObject({
    type: z.literal("conversation"),
    npcId: zIdentifier,
    progress: zConversationProgress,
    transcript: z.array(zConversationTranscriptEntry),
    pendingGiftItemId: zIdentifier.nullable(),
  })
  .superRefine((scene, context) => {
    if (scene.progress.phase !== "completed") return
    const entry = scene.transcript[scene.progress.completion.transcriptIndex]
    if (
      !entry ||
      (entry.type !== "dialogue_completed" && entry.type !== "option_selected") ||
      entry.dialogueId !== scene.progress.dialogueId
    ) {
      context.addIssue({
        code: "custom",
        message: "Completion receipt must reference the active dialogue completion entry",
        path: ["progress", "completion", "transcriptIndex"],
      })
    }
  })

const zCraftingResult = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("pending") }),
  z.strictObject({
    status: z.literal("success"),
    quality: z.enum(["normal", "high"]),
    diceResult: zSkillCheckResult,
  }),
  z.strictObject({
    status: z.literal("failure"),
    diceResult: zSkillCheckResult,
    materialsLost: zFiniteNumber,
  }),
])

const zCraftingSceneSnapshot = z.strictObject({
  type: z.literal("crafting"),
  selectedRecipeId: zIdentifier.nullable(),
  confirmingCraft: z.boolean(),
  result: zCraftingResult,
  message: zCraftingMessage.nullable(),
})

const zQuestSceneSnapshot = z.strictObject({
  type: z.literal("quest"),
  selectedQuestId: zIdentifier.nullable(),
  message: zQuestMessage.nullable(),
})

const zLevelUpSceneSnapshot = z.strictObject({
  type: z.literal("level_up"),
  availablePoints: zIndex,
  pendingAttributes: z.strictObject({
    strength: zIndex.optional(),
    dexterity: zIndex.optional(),
    agility: zIndex.optional(),
    vitality: zIndex.optional(),
    wisdom: zIndex.optional(),
    charisma: zIndex.optional(),
  }),
  returnAreaId: zIdentifier.nullable(),
})

const zBattleStatus = z.strictObject({
  attributes: z.strictObject({
    attack: zFiniteNumber,
    defense: zFiniteNumber,
    speed: zFiniteNumber,
  }),
  resources: z.strictObject({
    health: z.strictObject({
      current: zFiniteNumber,
      maximum: zFiniteNumber,
    }),
    mana: z.strictObject({
      current: zFiniteNumber,
      maximum: zFiniteNumber,
    }),
  }),
  custom: zJsonPayload.optional(),
})

const zBattleEffect = z.strictObject({
  instanceId: zIdentifier,
  effectId: zIdentifier,
  sourceId: zIdentifier,
  tags: z.array(zIdentifier),
  stacks: z.number().int().positive(),
  maximumStacks: z.number().int().positive(),
  lifetime: z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("permanent") }),
    z.strictObject({
      type: z.literal("turns"),
      remaining: z.number().int().positive(),
    }),
  ]),
  payload: zJsonPayload,
})

const zBattleCharacter = z.strictObject({
  id: zIdentifier,
  name: z.string(),
  custom: zJsonPayload.optional(),
  status: zBattleStatus,
  effects: z.array(zBattleEffect),
})

const zBattleMonster = zBattleCharacter.extend({
  groupId: zIdentifier,
})

const zBattleTurnAction = z.strictObject({
  id: zIdentifier,
  type: z.enum(["attack", "ability", "defend", "item", "flee"]),
  actorId: zIdentifier,
  targetIds: z.array(zIdentifier),
  abilityId: zIdentifier.nullable(),
  itemId: zIdentifier.nullable(),
})

const zBattleContext = z.strictObject({
  id: zIdentifier,
  turnNumber: z.number().int().positive(),
  party: z.strictObject({
    id: zIdentifier,
    members: z.array(zBattleCharacter).min(1),
  }),
  enemies: z.strictObject({
    id: zIdentifier,
    groups: z
      .array(
        z.strictObject({
          id: zIdentifier,
          name: z.string(),
          members: z.array(zBattleMonster).min(1),
        }),
      )
      .min(1),
  }),
  executedActions: z.array(zBattleTurnAction),
  initiative: z.enum(["party", "enemies", "none"]),
})

const zBattleReward = z.strictObject({
  experience: zFiniteNumber,
  gold: zFiniteNumber,
  droppedItems: z.array(
    z.strictObject({
      itemId: zIdentifier,
      quantity: zFiniteNumber,
    }),
  ),
  custom: zJsonPayload.optional(),
})

const zBattlePhase = z.discriminatedUnion("phase", [
  z.strictObject({
    phase: z.literal("encounter"),
    context: zBattleContext,
  }),
  z.strictObject({
    phase: z.literal("turnOrder"),
    context: zBattleContext,
    turnOrder: z.array(
      z.strictObject({
        actorId: zIdentifier,
        speed: zFiniteNumber,
      }),
    ),
    currentActorIndex: zIndex,
  }),
  z.strictObject({
    phase: z.literal("victory"),
    context: zBattleContext,
    reward: zBattleReward.optional(),
  }),
  z.strictObject({
    phase: z.literal("defeat"),
    context: zBattleContext,
  }),
])

const zBattleSceneSnapshot = z.strictObject({
  type: z.literal("battle"),
  /** Battle runtime state is captured as a JSON-only DTO. */
  runtimeFormat: z.literal("standard-battle"),
  returnAreaId: zIdentifier,
  phase: zBattlePhase,
})

const zBuiltInSceneSnapshot = z.discriminatedUnion("type", [
  zVillageSceneSnapshot,
  zShopSceneSnapshot,
  zInnSceneSnapshot,
  zExplorationSceneSnapshot,
  zBattleSceneSnapshot,
  zConversationSceneSnapshot,
  zCraftingSceneSnapshot,
  zQuestSceneSnapshot,
  zLevelUpSceneSnapshot,
])

const zPluginSceneSnapshot = z.strictObject({
  type: z.literal("plugin"),
  sceneType: zIdentifier.refine((type) => {
    try {
      WizStandardSceneName.assertPlugin(type)
      return true
    } catch {
      return false
    }
  }, "Plugin scene type must be non-empty, trimmed, and not reserved"),
  data: zJsonPayload,
})

const zStandardSceneSnapshot = z.union([zBuiltInSceneSnapshot, zPluginSceneSnapshot])

export const zWizStandardSessionData = z.strictObject({
  world: zWorldSnapshotData,
  scene: zStandardSceneSnapshot,
})

type WizStandardBuiltInSceneSchemaData = z.infer<typeof zBuiltInSceneSnapshot>
type WizStandardBattleSceneSchemaData = Extract<
  WizStandardBuiltInSceneSchemaData,
  { type: "battle" }
>
type WizStandardBattlePhaseSchemaData = WizStandardBattleSceneSchemaData["phase"]
type WizStandardBattleVictoryPhaseSchemaData = Extract<
  WizStandardBattlePhaseSchemaData,
  { phase: "victory" }
>
type WizStandardBattleRewardSchemaData = NonNullable<
  WizStandardBattleVictoryPhaseSchemaData["reward"]
>

type WizStandardBattleRewardCustomData<TRewardCustom> = undefined extends TRewardCustom
  ? Readonly<{ custom?: WizDeepReadonly<TRewardCustom> }>
  : Readonly<{ custom: WizDeepReadonly<TRewardCustom> }>

type WizStandardBattleRewardSnapshotData<TRewardCustom> = Omit<
  WizStandardBattleRewardSchemaData,
  "custom"
> &
  WizStandardBattleRewardCustomData<TRewardCustom>

export type WizStandardBuiltInSceneSnapshotData<TRewardCustom = undefined> =
  | Exclude<WizStandardBuiltInSceneSchemaData, { type: "battle" }>
  | (Omit<WizStandardBattleSceneSchemaData, "phase"> &
      Readonly<{
        phase:
          | Exclude<WizStandardBattlePhaseSchemaData, { phase: "victory" }>
          | (Omit<WizStandardBattleVictoryPhaseSchemaData, "reward"> &
              Readonly<{
                reward?: WizStandardBattleRewardSnapshotData<TRewardCustom> | undefined
              }>)
      }>)
export type WizStandardPluginSceneSnapshotData<TData extends object = object> = Readonly<{
  type: "plugin"
  sceneType: string
  data: TData
}>
export type WizStandardSceneSnapshotData<
  TPluginData extends object = object,
  TPluginScene extends WizStandardPluginSceneSnapshotData<TPluginData> =
    WizStandardPluginSceneSnapshotData<TPluginData>,
  TRewardCustom = undefined,
> = WizStandardBuiltInSceneSnapshotData<TRewardCustom> | TPluginScene
export type WizStandardSessionData<
  TPluginData extends object = object,
  TPluginScene extends WizStandardPluginSceneSnapshotData<TPluginData> =
    WizStandardPluginSceneSnapshotData<TPluginData>,
  TWorldData extends WorldSnapshotData = WorldSnapshotData,
  TRewardCustom = undefined,
> = Readonly<{
  world: TWorldData
  scene: WizStandardSceneSnapshotData<TPluginData, TPluginScene, TRewardCustom>
}>

export type WizStandardPluginSceneCodecValue = Readonly<{
  type: string
  [pluginSceneStateType]: WizStandardSessionPluginSceneState
  [pluginSceneInputType]: object
  [pluginSceneOutputType]: object
  [pluginSceneContentType]: WorldContentArrays
}>

type PluginSceneCodecRuntime = Readonly<{
  type: string
  capture(state: WizStandardSessionPluginSceneState): object
  [captureValidatedPluginScene](
    state: WizStandardSessionPluginSceneState,
  ): WizStandardValidatedCapture<object, object>
  parse(input: unknown): object
  restore(
    input: unknown,
    context: WizStandardPluginSceneRestoreContext<WorldContentArrays>,
  ): WizStandardSessionPluginSceneState
  [restoreCapturedPluginScene](
    data: object,
    context: WizStandardPluginSceneRestoreContext<WorldContentArrays>,
  ): WizStandardSessionPluginSceneState
}>

const isAuthenticPluginSceneCodec = (
  codec: WizStandardPluginSceneCodecValue,
): codec is WizStandardPluginSceneCodecValue & PluginSceneCodecRuntime =>
  authenticPluginSceneCodecs.has(codec)

type PluginSceneCodecLookup = (sceneType: string) => PluginSceneCodecRuntime | undefined

const createPluginSceneCodecLookup = (
  pluginScenes: readonly PluginSceneCodecRuntime[],
): PluginSceneCodecLookup => {
  const codecsByType = Object.create(null) as Record<string, PluginSceneCodecRuntime>
  for (const codec of pluginScenes) {
    Object.defineProperty(codecsByType, codec.type, {
      configurable: false,
      enumerable: true,
      value: codec,
      writable: false,
    })
  }
  Object.freeze(codecsByType)
  return Object.freeze((sceneType: string) => codecsByType[sceneType])
}

type PluginStateOf<TCodec> = TCodec extends {
  readonly [pluginSceneStateType]: infer TState
}
  ? TState extends WizStandardSessionPluginSceneState
    ? TState
    : never
  : never
type PluginDataOf<TCodec> = TCodec extends {
  readonly [pluginSceneInputType]: infer TData
}
  ? TData extends object
    ? TData
    : never
  : never
type PluginContentOf<TCodec> = TCodec extends {
  readonly [pluginSceneContentType]: infer TArrays
}
  ? TArrays extends WorldContentArrays
    ? TArrays
    : never
  : never

type PluginSceneSnapshotOf<TCodec> = TCodec extends WizStandardPluginSceneCodecValue
  ? Readonly<{
      type: "plugin"
      sceneType: PluginStateOf<TCodec>["type"]
      data: PluginDataOf<TCodec>
    }>
  : never

export type WizStandardPluginSceneCodecState<TCodec> = PluginStateOf<TCodec>
export type WizStandardPluginSceneCodecData<TCodec> = PluginDataOf<TCodec>
export type WizStandardPluginSceneCodecContent<TCodec> = PluginContentOf<TCodec>
export type WizStandardPluginSceneCodecSnapshot<TCodec> = PluginSceneSnapshotOf<TCodec>

export type WizStandardSessionPluginSceneState = WizPluginSceneState & WizImmutableValueContract

type WizStandardUnionMember<TValue, TWhole = TValue> = TValue extends unknown
  ? [TWhole] extends [TValue]
    ? false
    : true
  : never

type WizStandardSingleLiteralSceneType<TType extends string> = string extends TType
  ? never
  : true extends WizStandardUnionMember<TType>
    ? never
    : unknown

export type WizStandardPluginSceneCodecDefinition<
  TState extends WizStandardSessionPluginSceneState,
  TInput extends object,
  TOutput extends object = TInput,
  TArrays extends WorldContentArrays = WorldContentArrays,
  TType extends TState["type"] = TState["type"],
> = Readonly<{
  type: TType
  /**
   * 構築後に変更しない、信頼済みの純粋なvalidation dependency。
   * codecはStandard Schema validatorを構築時に捕捉する。
   */
  schema: WizStandardSchemaDefinition<TInput, TOutput>
  /** runtime stateをschema inputとなるJSON wire dataへ写す純粋関数。 */
  capture: (state: TState) => TInput
  /** schema outputからruntime stateを再構築する純粋関数。 */
  restore: (
    data: WizDeepReadonly<TOutput>,
    context: WizStandardPluginSceneRestoreContext<TArrays>,
  ) => TState
}> &
  WizStandardSingleLiteralSceneType<TType> &
  ([TState["type"]] extends [TType] ? ([TType] extends [TState["type"]] ? unknown : never) : never)

/**
 * plugin sceneのmethodを保存せず、JSON dataとの明示的な対応だけを定義する不変codec。
 */
export class WizStandardPluginSceneCodec<
  TState extends WizStandardSessionPluginSceneState,
  TInput extends object,
  TOutput extends object = TInput,
  TArrays extends WorldContentArrays = WorldContentArrays,
> {
  declare readonly [pluginSceneStateType]: TState
  declare readonly [pluginSceneInputType]: TInput
  declare readonly [pluginSceneOutputType]: TOutput
  declare readonly [pluginSceneContentType]: TArrays
  readonly #schema: WizStandardSchema<TInput, TOutput>
  readonly type: TState["type"]
  private readonly captureState: (state: TState) => TInput
  private readonly restoreState: (
    data: WizDeepReadonly<TOutput>,
    context: WizStandardPluginSceneRestoreContext<TArrays>,
  ) => TState

  private constructor(
    token: symbol,
    definition: WizStandardPluginSceneCodecDefinition<TState, TInput, TOutput, TArrays>,
  ) {
    assertStandardSessionConstructionToken(token)
    WizStandardSceneName.assertPlugin(definition.type)
    this.type = definition.type
    this.#schema = WizStandardSchema.capture(
      definition.schema,
      `Plugin scene "${definition.type}" schema`,
    )
    this.captureState = Object.freeze(definition.capture.bind(undefined))
    this.restoreState = Object.freeze(definition.restore.bind(undefined))
    authenticPluginSceneCodecs.add(this)
    Object.freeze(this)
  }

  static define<
    TState extends WizStandardSessionPluginSceneState,
    TInput extends object,
    TOutput extends object = TInput,
    TArrays extends WorldContentArrays = WorldContentArrays,
    const TType extends TState["type"] = TState["type"],
  >(
    definition: WizStandardPluginSceneCodecDefinition<TState, TInput, TOutput, TArrays, TType>,
  ): WizStandardPluginSceneCodec<TState, TInput, TOutput, TArrays> {
    return new WizStandardPluginSceneCodec(
      standardSessionConstructionToken,
      definition as WizStandardPluginSceneCodecDefinition<TState, TInput, TOutput, TArrays>,
    )
  }

  /** @internal plugin composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticPluginSceneCodecs.has(value)) {
      throw new TypeError(`${label} must be created with WizStandardPluginSceneCodec.define()`)
    }
  }

  capture(state: TState): WizDeepReadonly<TInput> {
    return this[captureValidatedPluginScene](state).wire
  }

  /** @internal Session capture reuses the canonical output without another transform. */
  [captureValidatedPluginScene](state: TState): WizStandardValidatedCapture<TInput, TOutput> {
    const ownedState = this.ownImmutableState(state)
    if (ownedState.type !== this.type) {
      throw new WizStandardSessionError(
        "PLUGIN_SCENE_TYPE_MISMATCH",
        `Plugin scene codec "${this.type}" cannot capture scene "${ownedState.type}"`,
        "$.scene.type",
      )
    }
    const wire = WizWorldSaveJsonOwnership.own(this.captureState(ownedState))
    const canonical = this.validateOwnedWire(wire)
    return Object.freeze({ canonical, wire })
  }

  restore(input: unknown, context: WizStandardPluginSceneRestoreContext<TArrays>): TState {
    const data = this.parse(input)
    return this[restoreCapturedPluginScene](data, context)
  }

  /** @internal Session snapshots already contain schema-canonical plugin data. */
  [restoreCapturedPluginScene](
    data: WizDeepReadonly<TOutput>,
    context: WizStandardPluginSceneRestoreContext<TArrays>,
  ): TState {
    const ownedContext: WizStandardPluginSceneRestoreContext<TArrays> = Object.freeze({
      vault: context.vault,
      content: context.content,
    })
    const state = this.restoreState(data, ownedContext)
    const ownedState = this.ownImmutableState(state)
    if (ownedState.type !== this.type) {
      throw new WizStandardSessionError(
        "PLUGIN_SCENE_TYPE_MISMATCH",
        `Plugin scene codec "${this.type}" restored scene "${ownedState.type}"`,
        "$.scene.type",
      )
    }
    if (ownedState.vault !== ownedContext.vault) {
      throw new WizStandardSessionError(
        "PLUGIN_SCENE_VAULT_MISMATCH",
        `Plugin scene codec "${this.type}" must restore with the supplied vault`,
        "$.scene",
      )
    }
    return ownedState
  }

  parse(input: unknown): WizDeepReadonly<TOutput> {
    const wire = WizWorldSaveJsonOwnership.own(input)
    return this.validateOwnedWire(wire)
  }

  private validateOwnedWire(input: unknown): WizDeepReadonly<TOutput> {
    return sessionOwnership.ownImmutable(this.#schema.validate(input))
  }

  private ownImmutableState(state: TState): TState {
    try {
      if (!WizImmutableValue.is(state)) {
        throw new TypeError("Plugin scene state must declare the immutable value contract")
      }
      return pluginSceneOwnership.ownImmutable(state)
    } catch {
      throw new WizStandardSessionError(
        "PLUGIN_SCENE_IMMUTABLE_CONTRACT_MISMATCH",
        `Plugin scene codec "${this.type}" requires a deeply immutable scene state`,
        "$.scene",
      )
    }
  }
}

Object.freeze(WizStandardPluginSceneCodec.prototype)
Object.freeze(WizStandardPluginSceneCodec)

export type WizStandardRewardCustomCodecDefinition<TCustom, TInput> = Readonly<{
  schema: WizStandardSchemaDefinition<TInput, TCustom>
  capture: (custom: WizDeepReadonly<TCustom>) => TInput
}>

/**
 * battle rewardのruntime値とJSON wire値を相互変換する不変codec。
 *
 * `capture`はruntime outputからschema inputを作る純粋関数で、`capture`と`parse`は
 * それぞれのvalidation境界でschema変換を一度だけ実行する。
 */
export class WizStandardRewardCustomCodec<TCustom, TInput = TCustom> {
  readonly #schema: WizStandardSchema<TInput, TCustom>
  readonly #captureCustom: (custom: WizDeepReadonly<TCustom>) => TInput
  declare private readonly customInvariant: (custom: TCustom) => TCustom
  declare private readonly inputInvariant: (input: TInput) => TInput
  declare readonly [rewardCustomType]: TCustom
  declare readonly [rewardCustomInputType]: TInput

  private constructor(
    token: symbol,
    definition: WizStandardRewardCustomCodecDefinition<TCustom, TInput>,
  ) {
    assertStandardSessionConstructionToken(token)
    this.#schema = WizStandardSchema.capture(definition.schema, "Standard reward custom schema")
    this.#captureCustom = Object.freeze(definition.capture.bind(undefined))
    authenticRewardCustomCodecs.add(this)
    Object.freeze(this)
  }

  static define<const TSchema extends WizStandardSchemaDefinition>(
    definition: Readonly<{
      schema: TSchema
      capture: (
        custom: WizDeepReadonly<WizStandardSchemaOutput<TSchema>>,
      ) => WizStandardSchemaInput<TSchema>
    }>,
  ): WizStandardRewardCustomCodec<
    WizStandardSchemaOutput<TSchema>,
    WizStandardSchemaInput<TSchema>
  > {
    return new WizStandardRewardCustomCodec(
      standardSessionConstructionToken,
      definition as WizStandardRewardCustomCodecDefinition<
        WizStandardSchemaOutput<TSchema>,
        WizStandardSchemaInput<TSchema>
      >,
    )
  }

  /** @internal battle model composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticRewardCustomCodecs.has(value)) {
      throw new TypeError(`${label} must be created with WizStandardRewardCustomCodec.define()`)
    }
  }

  capture(custom: WizDeepReadonly<TCustom>): WizDeepReadonly<TInput> {
    return this[captureValidatedRewardCustom](custom).wire
  }

  /** @internal Session capture reuses the canonical output without another transform. */
  [captureValidatedRewardCustom](
    custom: WizDeepReadonly<TCustom>,
  ): WizStandardValidatedCapture<TInput, TCustom> {
    const captured = this.#captureCustom(custom)
    const wire =
      captured === undefined
        ? (undefined as WizDeepReadonly<TInput>)
        : WizWorldSaveJsonOwnership.own(captured)
    const canonical = this.validateOwnedWire(wire)
    return Object.freeze({ canonical, wire })
  }

  parse(input: unknown): WizDeepReadonly<TCustom> {
    const wire = input === undefined ? undefined : WizWorldSaveJsonOwnership.own(input)
    return this.validateOwnedWire(wire)
  }

  private validateOwnedWire(input: unknown): WizDeepReadonly<TCustom> {
    return sessionOwnership.ownImmutable(this.#schema.validate(input))
  }
}

Object.freeze(WizStandardRewardCustomCodec.prototype)
Object.freeze(WizStandardRewardCustomCodec)

const undefinedRewardCustomCodec = WizStandardRewardCustomCodec.define({
  schema: zUndefinedRewardCustom,
  capture: (custom) => custom,
})

export type WizStandardSessionErrorCode =
  | "PLUGIN_SCENE_CODEC_MISSING"
  | "PLUGIN_SCENE_TYPE_MISMATCH"
  | "PLUGIN_SCENE_IMMUTABLE_CONTRACT_MISMATCH"
  | "PLUGIN_SCENE_VAULT_MISMATCH"
  | "SCENE_REFERENCE_NOT_FOUND"
  | "SCENE_REFERENCE_INVALID"
  | "UNSUPPORTED_SCENE_STATE"

export class WizStandardSessionError extends Error {
  override readonly name = "WizStandardSessionError"

  constructor(
    readonly code: WizStandardSessionErrorCode,
    message: string,
    readonly path: string,
    readonly referenceId?: string,
  ) {
    super(message)
    Object.freeze(this)
  }
}

/**
 * schema/content version とworld + scene snapshotを一体で保持する不変値。
 */
export class WizStandardSessionSnapshot<
  TExtraState extends WizPluginSceneState = never,
  TPluginData extends object = object,
  TPluginScene extends WizStandardPluginSceneSnapshotData<TPluginData> =
    WizStandardPluginSceneSnapshotData<TPluginData>,
  TWorldData extends WorldSnapshotData = WorldSnapshotData,
  TRewardCustom = undefined,
  TRewardCustomInput = TRewardCustom,
> {
  readonly schemaVersion: number
  readonly contentVersion: string
  readonly world: WorldSnapshot<WorldSnapshotCanonicalData<TWorldData>>
  readonly scene: WizDeepReadonly<
    WizStandardSceneSnapshotData<TPluginData, TPluginScene, TRewardCustomInput>
  >
  /** Type-only link between a plugin state union and its snapshot codec. */
  declare private readonly extraState: TExtraState
  declare private readonly rewardCustomInvariant: (reward: TRewardCustom) => TRewardCustom
  declare private readonly standardSessionSnapshotType: true

  protected constructor(
    token: typeof standardSessionConstructionToken,
    owner: object,
    envelope: WizWorldSaveEnvelope<
      WizStandardSessionData<TPluginData, TPluginScene, TWorldData, TRewardCustomInput>
    >,
    canonicalScene?: object,
  ) {
    assertStandardSessionConstructionToken(token)
    this.schemaVersion = envelope.schemaVersion
    this.contentVersion = envelope.contentVersion
    this.world = WorldSnapshot.create(envelope.snapshot.world as TWorldData)
    this.scene = sessionOwnership.ownImmutable<
      WizStandardSceneSnapshotData<TPluginData, TPluginScene, TRewardCustomInput>
    >(envelope.snapshot.scene)
    authenticStandardSessionSnapshots.add(this)
    standardSessionSnapshotOwners.set(this, owner)
    if (canonicalScene !== undefined) {
      canonicalStandardSessionScenes.set(this, sessionOwnership.ownImmutable(canonicalScene))
    }
    Object.freeze(this)
  }

  toEnvelope(): WizWorldSaveEnvelope<
    WizStandardSessionData<
      TPluginData,
      TPluginScene,
      WorldSnapshotCanonicalData<TWorldData>,
      TRewardCustomInput
    >
  > {
    assertAuthenticStandardSessionSnapshot(this)
    const envelope: WizWorldSaveEnvelope<
      WizStandardSessionData<
        TPluginData,
        TPluginScene,
        WorldSnapshotCanonicalData<TWorldData>,
        TRewardCustomInput
      >
    > = {
      schemaVersion: this.schemaVersion,
      contentVersion: this.contentVersion,
      snapshot: {
        world: this.world.toPlain() as WizDeepReadonly<WorldSnapshotCanonicalData<TWorldData>>,
        scene: this.scene,
      },
    }
    return Object.freeze({
      ...envelope,
      snapshot: Object.freeze(envelope.snapshot),
    })
  }
}

class WizStandardSessionSnapshotValue<
  TExtraState extends WizPluginSceneState = never,
  TPluginData extends object = object,
  TPluginScene extends WizStandardPluginSceneSnapshotData<TPluginData> =
    WizStandardPluginSceneSnapshotData<TPluginData>,
  TWorldData extends WorldSnapshotData = WorldSnapshotData,
  TRewardCustom = undefined,
  TRewardCustomInput = TRewardCustom,
> extends WizStandardSessionSnapshot<
  TExtraState,
  TPluginData,
  TPluginScene,
  TWorldData,
  TRewardCustom,
  TRewardCustomInput
> {
  constructor(
    owner: object,
    envelope: WizWorldSaveEnvelope<
      WizStandardSessionData<TPluginData, TPluginScene, TWorldData, TRewardCustomInput>
    >,
    canonicalScene?: object,
  ) {
    super(standardSessionConstructionToken, owner, envelope, canonicalScene)
  }
}

Object.freeze(WizStandardSessionSnapshot.prototype)
Object.freeze(WizStandardSessionSnapshot)
Object.freeze(WizStandardSessionSnapshotValue.prototype)
Object.freeze(WizStandardSessionSnapshotValue)

type WizStandardSessionCodecBaseOptions = Readonly<{
  contentVersion: string
}>

type RewardCustomCodecValue = Readonly<{
  [rewardCustomType]: unknown
  [rewardCustomInputType]: unknown
}>

type RewardCustomOf<TCodec> = TCodec extends {
  readonly [rewardCustomType]: infer TCustom
}
  ? TCustom
  : never

type RewardCustomInputOf<TCodec> = TCodec extends {
  readonly [rewardCustomInputType]: infer TInput
}
  ? TInput
  : never

export type WizStandardSessionCodecOptions<
  TPluginCodecs extends readonly WizStandardPluginSceneCodecValue[] = readonly [],
  TRewardCustomCodec extends RewardCustomCodecValue | undefined = undefined,
> = WizStandardSessionCodecBaseOptions &
  Readonly<{
    pluginScenes?: TPluginCodecs
    rewardCustom?: TRewardCustomCodec
  }>

export type WizStandardPluginSceneRestoreContext<
  TArrays extends WorldContentArrays = WorldContentArrays,
> = Readonly<{
  vault: WizVaultValue
  content: WorldContent<TArrays>
}>

type RestoreContext<TArrays extends WorldContentArrays> =
  WizStandardPluginSceneRestoreContext<TArrays> &
    Readonly<{
      battleCharacterAuthority?: WizSceneBattleCharacterAuthority
      battleMonsterAuthority?: WizSceneBattleMonsterAuthority
      battleContent?: WizEngineBattleContentResolver
      levelUpPointsPerLevel?: number
      shopDialogues?: WizEngineShopDialogueService
      effectConfig?: WizEffectConfig
      resolveRecipe?: (recipeId: string) => WizDeepReadonly<WizContentRecipe> | undefined
    }>

type WizStandardRestorableSceneSnapshotData<TRewardCustom> =
  | WizDeepReadonly<WizStandardBuiltInSceneSnapshotData<TRewardCustom>>
  | Readonly<{
      type: "plugin"
      sceneType: string
      data: object
    }>

const cleanOptionalObjectValues = (
  value: unknown,
  copies: WeakMap<object, object> = new WeakMap(),
): unknown => {
  if (Array.isArray(value)) {
    const existing = copies.get(value)
    if (existing) return existing
    const copy: unknown[] = []
    copies.set(value, copy)
    for (const entry of value) {
      copy.push(cleanOptionalObjectValues(entry, copies))
    }
    return copy
  }
  if (value === null || typeof value !== "object") {
    return value
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return value
  }
  const existing = copies.get(value)
  if (existing) return existing
  const copy: Record<string, unknown> = {}
  copies.set(value, copy)
  Object.assign(
    copy,
    Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) =>
        entry === undefined ? [] : [[key, cleanOptionalObjectValues(entry, copies)]],
      ),
    ),
  )
  return copy
}

const captureSceneMessage = <TMessage>(
  schema: z.ZodType<TMessage>,
  message: TMessage | null,
): TMessage | null => (message === null ? null : schema.parse(cleanOptionalObjectValues(message)))

const captureShopConversation = (
  conversation: WizSceneShopConversation | null,
): z.infer<typeof zShopConversationReference> | null =>
  conversation === null
    ? null
    : {
        topicId: conversation.topicId,
        currentIndex: conversation.currentIndex,
        displayedLineCount: conversation.displayedLines.length,
      }

const throwTransientExplorationSavePoint = (status: "encounter" | "rolling"): never => {
  throw new WizStandardSessionError(
    "UNSUPPORTED_SCENE_STATE",
    `Exploration event progress "${status}" is transient and cannot be saved or restored`,
    "$.scene.eventProgress.status",
  )
}

const captureExplorationProgress = (
  progress: WizSceneExplorationEventProgress,
): z.infer<typeof zExplorationEventProgress> => {
  if (progress.status === "none") return { status: "none" }
  if (progress.status === "encounter" || progress.status === "rolling") {
    return throwTransientExplorationSavePoint(progress.status)
  }
  if (progress.choiceIndex !== null && progress.event.choices[progress.choiceIndex] === undefined) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      `Exploration choiceIndex is not present in event "${progress.event.id}"`,
      "$.scene.eventProgress.choiceIndex",
      progress.event.id,
    )
  }
  const choice = progress.event.choices[progress.choiceIndex]!
  const expectedResultText = progress.diceResult.success ? choice.successText : choice.failText
  if (progress.resultText !== expectedResultText) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      `Exploration resultText does not match event "${progress.event.id}" choice content`,
      "$.scene.eventProgress.resultText",
      progress.event.id,
    )
  }
  return {
    status: "result",
    eventId: progress.event.id,
    choiceIndex: progress.choiceIndex,
    diceResult: {
      ...progress.diceResult,
      dice: [progress.diceResult.dice[0], progress.diceResult.dice[1]],
    },
  }
}

type BattleStatusData = z.infer<typeof zBattleStatus>
type BattleEffectData = z.infer<typeof zBattleEffect>
type BattleCharacterData = z.infer<typeof zBattleCharacter>
type BattleMonsterData = z.infer<typeof zBattleMonster>
type BattleTurnActionData = z.infer<typeof zBattleTurnAction>
type BattleContextData = z.infer<typeof zBattleContext>
type BattlePhaseData<TRewardCustom = undefined> =
  | Exclude<WizStandardBattlePhaseSchemaData, { phase: "victory" }>
  | (Omit<WizStandardBattleVictoryPhaseSchemaData, "reward"> &
      Readonly<{
        reward?: WizStandardBattleRewardSnapshotData<TRewardCustom> | undefined
      }>)

const captureRewardCustom = <TRewardCustom>(
  custom: TRewardCustom | WizDeepReadonly<TRewardCustom>,
): WizStandardBattleRewardCustomData<TRewardCustom> =>
  (custom === undefined
    ? {}
    : {
        custom: sessionOwnership.ownImmutable(custom),
      }) as WizStandardBattleRewardCustomData<TRewardCustom>

const captureBattleStatus = <TStatus>(status: WizBattleActorState<TStatus>): BattleStatusData => {
  return {
    attributes: status.attributes.toPlain(),
    resources: status.resources.toPlain(),
    ...(status.custom === undefined ? {} : { custom: status.custom }),
  }
}

const captureBattleEffect = (effect: WizEffect): BattleEffectData =>
  effect.toProperties() as BattleEffectData

const captureBattleCharacter = <TStatus, TCustom>(
  character: WizBattleCharacter<TStatus, TCustom>,
): BattleCharacterData => ({
  id: character.id,
  name: character.name,
  ...(character.custom === undefined ? {} : { custom: character.custom }),
  status: captureBattleStatus(character.status),
  effects: character.effects.effects.map(captureBattleEffect),
})

const captureBattleMonster = <TStatus, TCustom>(
  monster: WizBattleMonster<TStatus, TCustom>,
): BattleMonsterData => ({
  id: monster.id,
  name: monster.name,
  ...(monster.custom === undefined ? {} : { custom: monster.custom }),
  status: captureBattleStatus(monster.status),
  effects: monster.effects.effects.map(captureBattleEffect),
  groupId: monster.groupId,
})

const captureBattleAction = (action: WizEngineBattleTurnAction): BattleTurnActionData => ({
  id: action.id,
  type: action.type,
  actorId: action.actorId,
  targetIds: [...action.targetIds],
  abilityId: action.abilityId,
  itemId: action.itemId,
})

const captureBattleContext = <TStatus, TCustom>(
  context: WizEngineBattleContext<TStatus, TCustom>,
): BattleContextData => ({
  id: context.id,
  turnNumber: context.turnNumber,
  party: {
    id: context.party.id,
    members: context.party.members.map(captureBattleCharacter),
  },
  enemies: {
    id: context.enemies.id,
    groups: context.enemies.groups.map((group) => ({
      id: group.id,
      name: group.name,
      members: group.members.map(captureBattleMonster),
    })),
  },
  executedActions: context.executedActions.map(captureBattleAction),
  initiative: context.initiative,
})

const captureBattlePhase = <TStatus, TCustom, TRewardCustom, TRewardCustomInput>(
  phase: WizStateBattle<TStatus, TCustom, TRewardCustom>["phase"],
  captureCustom: (custom: WizDeepReadonly<TRewardCustom>) => WizDeepReadonly<TRewardCustomInput>,
): BattlePhaseData<TRewardCustomInput> => {
  const context = captureBattleContext(phase.context)
  if (phase.phase === "encounter") {
    return { phase: "encounter", context }
  }
  if (phase.phase === "turnOrder") {
    return {
      phase: "turnOrder",
      context,
      turnOrder: phase.turnOrder.map((actor) => ({
        actorId: actor.id,
        speed: actor.speed,
      })),
      currentActorIndex: phase.currentActorIndex,
    }
  }
  if (phase.phase === "defeat") {
    return { phase: "defeat", context }
  }
  return {
    phase: "victory",
    context,
    ...(phase.reward
      ? {
          reward: {
            experience: phase.reward.experience,
            gold: phase.reward.gold,
            droppedItems: phase.reward.droppedItems.map((item) => ({ ...item })),
            ...captureRewardCustom(captureCustom(phase.reward.custom)),
          },
        }
      : {}),
  }
}

const captureBuiltInScene = <TStatus, TCustom, TRewardCustom, TRewardCustomInput>(
  state: WizState<TStatus, TCustom, TRewardCustom>,
  captureReward: (custom: WizDeepReadonly<TRewardCustom>) => WizDeepReadonly<TRewardCustomInput>,
): WizStandardBuiltInSceneSnapshotData<TRewardCustomInput> => {
  switch (state.type) {
    case "village":
      return { type: "village", selectedAction: state.selectedAction }
    case "shop":
      return {
        type: "shop",
        shopId: state.shopId,
        buyPriceModifier: state.buyPriceModifier,
        pendingPurchase: state.pendingPurchase,
        message: captureSceneMessage(zShopMessage, state.message),
        conversation: captureShopConversation(state.conversation),
        lastConversation: captureShopConversation(state.lastConversation),
      }
    case "inn":
      return {
        type: "inn",
        selectedPlan: state.selectedPlan,
        confirmingStay: state.confirmingStay,
        message: captureSceneMessage(zInnMessage, state.message),
      }
    case "exploration":
      return {
        type: "exploration",
        areaId: state.areaId,
        eventProgress: captureExplorationProgress(state.eventProgress),
        message: captureSceneMessage(zExplorationMessage, state.message),
      }
    case "battle":
      return {
        type: "battle",
        runtimeFormat: "standard-battle",
        returnAreaId: state.returnAreaId,
        phase: captureBattlePhase(state.phase, captureReward),
      }
    case "conversation":
      return {
        type: "conversation",
        npcId: state.npcId,
        progress: state.progress.toPlain(),
        transcript: [...state.transcript],
        pendingGiftItemId: state.pendingGiftItemId,
      }
    case "crafting":
      return {
        type: "crafting",
        selectedRecipeId: state.selectedRecipe?.id ?? null,
        confirmingCraft: state.confirmingCraft,
        result:
          state.result.status === "pending"
            ? { status: "pending" }
            : state.result.status === "success"
              ? {
                  ...state.result,
                  diceResult: {
                    ...state.result.diceResult,
                    dice: [state.result.diceResult.dice[0], state.result.diceResult.dice[1]],
                  },
                }
              : {
                  ...state.result,
                  diceResult: {
                    ...state.result.diceResult,
                    dice: [state.result.diceResult.dice[0], state.result.diceResult.dice[1]],
                  },
                },
        message: captureSceneMessage(zCraftingMessage, state.message),
      }
    case "quest":
      return {
        type: "quest",
        selectedQuestId: state.selectedQuest?.id ?? null,
        message: captureSceneMessage(zQuestMessage, state.message),
      }
    case "level_up":
      return {
        type: "level_up",
        availablePoints: state.availablePoints,
        pendingAttributes: state.pendingAttributes,
        returnAreaId: state.returnAreaId,
      }
  }
}

const withCapturedBattleRewardCustom = <TWire, TCanonical>(
  scene: WizDeepReadonly<WizStandardBuiltInSceneSnapshotData<TWire>>,
  custom: WizDeepReadonly<TCanonical>,
): WizDeepReadonly<WizStandardBuiltInSceneSnapshotData<TCanonical>> => {
  if (
    scene.type !== "battle" ||
    scene.phase.phase !== "victory" ||
    scene.phase.reward === undefined
  ) {
    throw new TypeError("Captured reward custom data requires a victory reward scene")
  }
  const { custom: _wireCustom, ...reward } = scene.phase.reward
  return sessionOwnership.ownImmutable({
    ...scene,
    phase: {
      ...scene.phase,
      reward: {
        ...reward,
        ...captureRewardCustom(custom),
      },
    },
  }) as WizDeepReadonly<WizStandardBuiltInSceneSnapshotData<TCanonical>>
}

const requireReference = <T>(value: T | undefined, path: string, referenceId: string): T => {
  if (value !== undefined) return value
  throw new WizStandardSessionError(
    "SCENE_REFERENCE_NOT_FOUND",
    `Standard session reference "${referenceId}" at ${path} was not found in current content`,
    path,
    referenceId,
  )
}

const requireUnlockedArea = (
  vault: WizVaultValue,
  areaId: string,
  path: string,
): WizVaultValue["areas"][number] => {
  const area = requireReference(
    vault.areas.find((candidate) => candidate.id === areaId),
    path,
    areaId,
  )
  if (!area.unlocked) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      `Standard session area "${areaId}" at ${path} is locked`,
      path,
      areaId,
    )
  }
  return area
}

const restoreShopConversation = (
  reference: z.infer<typeof zShopConversationReference> | null,
  shopId: string,
  service: WizEngineShopDialogueService | undefined,
  path: string,
): WizSceneShopConversation | null => {
  if (reference === null) return null
  const dialogue = service?.getDialogue(shopId)
  const topic = requireReference(
    dialogue?.topics.find((candidate) => candidate.id === reference.topicId),
    `${path}.topicId`,
    reference.topicId,
  )
  if (
    reference.currentIndex > topic.lines.length ||
    reference.displayedLineCount > topic.lines.length
  ) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      `Shop dialogue indexes at ${path} exceed topic "${reference.topicId}" line count`,
      path,
      reference.topicId,
    )
  }
  return {
    topicId: reference.topicId,
    lines: topic.lines,
    currentIndex: reference.currentIndex,
    displayedLines: topic.lines.slice(0, reference.displayedLineCount),
  }
}

type ShopPurchaseData = z.infer<typeof zShopPurchase>

const restoreShopPurchase = (
  purchase: ShopPurchaseData | null,
  buyPriceModifier: number,
  content: Pick<WorldContent, "getItem" | "getWeapon" | "getArmor">,
  products: WizContentShopProducts | undefined,
): ShopPurchaseData | null => {
  if (purchase === null) return null

  const definition =
    purchase.type === "item"
      ? content.getItem(purchase.itemId)
      : purchase.type === "weapon"
        ? content.getWeapon(purchase.weaponId)
        : content.getArmor(purchase.armorId)
  const productId =
    purchase.type === "item"
      ? purchase.itemId
      : purchase.type === "weapon"
        ? purchase.weaponId
        : purchase.armorId
  const price = requireReference(
    definition?.price,
    `$.scene.pendingPurchase.${purchase.type}Id`,
    productId,
  )
  const isSold =
    products === undefined ||
    (purchase.type === "item"
      ? products.itemIds.includes(productId)
      : purchase.type === "weapon"
        ? products.weaponIds.includes(productId)
        : products.armorIds.includes(productId))
  if (!isSold) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      `Shop purchase "${productId}" is not sold by the current shop`,
      `$.scene.pendingPurchase.${purchase.type}Id`,
      productId,
    )
  }
  const canonicalPrice = Math.floor(price * buyPriceModifier)

  if (purchase.price !== canonicalPrice) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      `Shop purchase price for "${productId}" does not match current content`,
      "$.scene.pendingPurchase.price",
      productId,
    )
  }
  return { ...purchase, price: canonicalPrice }
}

const assertShopPurchaseMessageCorrelation = (
  message: WizSceneShopMessage | null,
  pendingPurchase: ShopPurchaseData | null,
): void => {
  if (message?.type !== "purchase_prompt") return
  if (pendingPurchase === null) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      "Shop purchase prompt requires a pending purchase",
      "$.scene.message",
    )
  }
  const productId =
    pendingPurchase.type === "item"
      ? pendingPurchase.itemId
      : pendingPurchase.type === "weapon"
        ? pendingPurchase.weaponId
        : pendingPurchase.armorId
  if (
    message.productType !== pendingPurchase.type ||
    message.productId !== productId ||
    message.price !== pendingPurchase.price
  ) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      "Shop purchase prompt does not match the pending purchase",
      "$.scene.message",
      productId,
    )
  }
}

const restoreConversationState = (
  scene: WizDeepReadonly<Extract<WizStandardBuiltInSceneSnapshotData, { type: "conversation" }>>,
  vault: WizVaultValue,
): WizStateConversation => {
  const npc = requireReference(
    vault.npcs.find((candidate) => candidate.id === scene.npcId),
    "$.scene.npcId",
    scene.npcId,
  )

  if (
    scene.pendingGiftItemId !== null &&
    vault.inventory.totalQuantity("item", scene.pendingGiftItemId) === 0
  ) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      `Pending gift "${scene.pendingGiftItemId}" is not present in inventory`,
      "$.scene.pendingGiftItemId",
      scene.pendingGiftItemId,
    )
  }

  const failTranscript = (message: string, index: number, referenceId?: string): never => {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      message,
      `$.scene.transcript[${index}]`,
      referenceId,
    )
  }

  /**
   * A completed transcript is a historical receipt, not a projection of current content.
   *
   * Content may remove a dialogue, line, or option after the receipt was committed. The
   * transcript still proves its own ordering and completion index, while presentation can use
   * neutral placeholders for definitions which no longer exist. An active conversation takes
   * the stricter path below because continuing it still requires current content authority.
   */
  if (scene.progress.phase === "completed") {
    const completionIndex = scene.progress.completion.transcriptIndex
    let activeDialogueId: string | null = null
    let nextLineIndex = 0
    let hasStarted = false
    let expectsResponseStart = false
    let hasReachedCompletion = false

    for (let index = 0; index < scene.transcript.length; index += 1) {
      const entry = scene.transcript[index]!
      if (entry.type === "gift_applied") continue
      if (hasReachedCompletion) {
        failTranscript("Conversation events cannot follow a completion receipt", index)
      }

      if (entry.type === "dialogue_started") {
        if (hasStarted && !expectsResponseStart) {
          failTranscript(
            `Dialogue "${entry.dialogueId}" was not opened by an option response`,
            index,
            entry.dialogueId,
          )
        }
        activeDialogueId = entry.dialogueId
        nextLineIndex = 0
        hasStarted = true
        expectsResponseStart = false
        continue
      }

      if (activeDialogueId === null || expectsResponseStart) {
        failTranscript("Conversation entry requires an active dialogue", index)
      }
      if (entry.dialogueId !== activeDialogueId) {
        failTranscript(
          `Conversation entry does not match active dialogue "${activeDialogueId}"`,
          index,
          entry.dialogueId,
        )
      }

      if (entry.type === "dialogue_line") {
        if (entry.lineIndex !== nextLineIndex) {
          failTranscript(
            `Dialogue line index ${entry.lineIndex} is not the next historical line`,
            index,
            entry.dialogueId,
          )
        }
        nextLineIndex += 1
        continue
      }

      if (index === completionIndex) {
        hasReachedCompletion = true
        continue
      }
      if (entry.type === "dialogue_completed") {
        failTranscript("Dialogue completion does not match its completion receipt", index)
      }

      // A non-terminal option must be followed by the response dialogue which runtime opened
      // atomically with the option. Its exact ID is historical data and need not exist in the
      // current content graph.
      activeDialogueId = null
      expectsResponseStart = true
    }

    if (!hasReachedCompletion) {
      failTranscript(
        "Conversation completion receipt does not reference a terminal transcript entry",
        completionIndex,
      )
    }
    if (expectsResponseStart) {
      throw new WizStandardSessionError(
        "SCENE_REFERENCE_INVALID",
        "Conversation response dialogue was not started",
        "$.scene.transcript",
      )
    }

    const expectedProgress: WizConversationProgressData = {
      phase: "completed",
      dialogueId: scene.progress.dialogueId,
      nextLineIndex,
      completion: {
        transcriptIndex: completionIndex,
      },
    }
    if (!areBattleSnapshotValuesEqual(scene.progress, expectedProgress)) {
      throw new WizStandardSessionError(
        "SCENE_REFERENCE_INVALID",
        "Conversation progress does not match its semantic transcript",
        "$.scene.progress",
        scene.progress.dialogueId,
      )
    }

    return new WizStateConversation({
      type: "conversation",
      npcId: scene.npcId,
      progress: new WizConversationProgress(scene.progress),
      transcript: scene.transcript as readonly WizConversationTranscriptEntry[],
      pendingGiftItemId: scene.pendingGiftItemId,
      vault,
    })
  }

  type ActiveDialogue = Readonly<{
    dialogue: (typeof npc.dialogues)[number]
    nextLineIndex: number
  }>
  type TerminalReceipt = Readonly<{
    dialogueId: string
    transcriptIndex: number
  }>

  let active: ActiveDialogue | null = null
  let expectedResponseDialogueId: string | null = null
  let terminal: TerminalReceipt | null = null
  let hasStarted = false

  const findDialogue = (dialogueId: string, index: number) => {
    const dialogue = npc.dialogues.find((candidate) => candidate.id === dialogueId)
    return (
      dialogue ??
      failTranscript(
        `Conversation dialogue "${dialogueId}" is missing from current content`,
        index,
        dialogueId,
      )
    )
  }
  const requireActiveDialogue = (value: ActiveDialogue | null, index: number): ActiveDialogue =>
    value ?? failTranscript("Conversation entry requires an active dialogue", index)

  for (let index = 0; index < scene.transcript.length; index += 1) {
    const entry = scene.transcript[index]!
    if (entry.type === "gift_applied") continue
    if (terminal) {
      failTranscript("Conversation events cannot follow a completion receipt", index)
    }

    if (entry.type === "dialogue_started") {
      if (
        (hasStarted && expectedResponseDialogueId === null) ||
        (expectedResponseDialogueId !== null && entry.dialogueId !== expectedResponseDialogueId)
      ) {
        failTranscript(
          `Dialogue "${entry.dialogueId}" is not the expected response`,
          index,
          entry.dialogueId,
        )
      }
      active = {
        dialogue: findDialogue(entry.dialogueId, index),
        nextLineIndex: 0,
      }
      expectedResponseDialogueId = null
      hasStarted = true
      continue
    }

    const current = requireActiveDialogue(active, index)
    if (expectedResponseDialogueId !== null) {
      failTranscript("Conversation entry requires an active dialogue", index)
    }
    if (entry.dialogueId !== current.dialogue.id) {
      failTranscript(
        `Conversation entry does not match active dialogue "${current.dialogue.id}"`,
        index,
        entry.dialogueId,
      )
    }

    if (entry.type === "dialogue_line") {
      if (
        entry.lineIndex !== current.nextLineIndex ||
        entry.lineIndex >= current.dialogue.lines.length
      ) {
        failTranscript(
          `Dialogue line index ${entry.lineIndex} is not the next current content line`,
          index,
          entry.dialogueId,
        )
      }
      active = {
        dialogue: current.dialogue,
        nextLineIndex: current.nextLineIndex + 1,
      }
      continue
    }

    if (entry.type === "option_selected") {
      const option =
        current.dialogue.options?.find((candidate) => candidate.id === entry.optionId) ??
        failTranscript(
          `Conversation option "${entry.optionId}" is missing from current content`,
          index,
          entry.optionId,
        )
      if (option.responseDialogueId) {
        expectedResponseDialogueId = option.responseDialogueId
        active = null
      } else {
        terminal = {
          dialogueId: entry.dialogueId,
          transcriptIndex: index,
        }
      }
      continue
    }

    if ((current.dialogue.options?.length ?? 0) > 0) {
      failTranscript("Dialogue with options must complete through an option", index)
    }
    terminal = {
      dialogueId: entry.dialogueId,
      transcriptIndex: index,
    }
  }

  if (expectedResponseDialogueId !== null) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      `Response dialogue "${expectedResponseDialogueId}" was not started`,
      "$.scene.transcript",
      expectedResponseDialogueId,
    )
  }

  let expectedProgress: WizConversationProgressData
  if (terminal) {
    expectedProgress = {
      phase: "completed",
      dialogueId: terminal.dialogueId,
      nextLineIndex: active?.nextLineIndex ?? scene.progress.nextLineIndex,
      completion: {
        transcriptIndex: terminal.transcriptIndex,
      },
    }
  } else if (!active) {
    expectedProgress = {
      phase: "idle",
      dialogueId: null,
      nextLineIndex: 0,
    }
  } else {
    const phase =
      active.nextLineIndex < active.dialogue.lines.length
        ? "reading"
        : (active.dialogue.options?.length ?? 0) > 0
          ? "choosing"
          : "ready_to_complete"
    expectedProgress = {
      phase,
      dialogueId: active.dialogue.id,
      nextLineIndex: active.nextLineIndex,
    }
  }

  if (!areBattleSnapshotValuesEqual(scene.progress, expectedProgress)) {
    throw new WizStandardSessionError(
      "SCENE_REFERENCE_INVALID",
      "Conversation progress does not match its semantic transcript",
      "$.scene.progress",
      scene.progress.dialogueId ?? undefined,
    )
  }

  return new WizStateConversation({
    type: "conversation",
    npcId: scene.npcId,
    progress: new WizConversationProgress(scene.progress),
    transcript: scene.transcript as readonly WizConversationTranscriptEntry[],
    pendingGiftItemId: scene.pendingGiftItemId,
    vault,
  })
}

const restoreExplorationProgress = (
  progress: WizDeepReadonly<z.infer<typeof zExplorationEventProgress>>,
  events: WizVaultValue["areas"][number]["events"],
): WizSceneExplorationEventProgress => {
  if (progress.status === "none") return { status: "none" }
  if (progress.status === "encounter" || progress.status === "rolling") {
    return throwTransientExplorationSavePoint(progress.status)
  }
  const currentEvent = requireReference(
    events.find((candidate) => candidate.id === progress.eventId),
    "$.scene.eventProgress.eventId",
    progress.eventId,
  )
  const event = WizVaultEventStateSchema.parse(currentEvent)
  const choice = requireReference(
    event.choices[progress.choiceIndex],
    "$.scene.eventProgress.choiceIndex",
    String(progress.choiceIndex),
  )
  return {
    status: "result",
    event,
    choiceIndex: progress.choiceIndex,
    diceResult: progress.diceResult as WizSkillCheckResult,
    resultText: progress.diceResult.success ? choice.successText : choice.failText,
  }
}

const BATTLE_CONTEXT_PATH = "$.scene.phase.context"

const throwInvalidBattleReference = (
  message: string,
  path: string,
  referenceId?: string,
): never => {
  throw new WizStandardSessionError("SCENE_REFERENCE_INVALID", message, path, referenceId)
}

const areBattleSnapshotValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => areBattleSnapshotValuesEqual(entry, right[index]))
    )
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false
  }
  const leftRecord = left as Readonly<Record<string, unknown>>
  const rightRecord = right as Readonly<Record<string, unknown>>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(rightRecord, key) &&
        areBattleSnapshotValuesEqual(leftRecord[key], rightRecord[key]),
    )
  )
}

const assertCanonicalBattleValue = (
  saved: unknown,
  canonical: unknown,
  path: string,
  referenceId: string,
): void => {
  if (areBattleSnapshotValuesEqual(saved, canonical)) return
  throwInvalidBattleReference(
    `Battle actor "${referenceId}" does not match current canonical content`,
    path,
    referenceId,
  )
}

const readBattleEffectSource = (payload: unknown, path: string): WizBattleEffectSource => {
  if (payload === null || typeof payload !== "object") {
    return throwInvalidBattleReference("Battle effect payload is invalid", `${path}.payload`)
  }
  const record = payload as Readonly<Record<string, unknown>>
  const source = record.source
  if (
    source === null ||
    typeof source !== "object" ||
    ((source as Readonly<Record<string, unknown>>).kind !== "item" &&
      (source as Readonly<Record<string, unknown>>).kind !== "ability" &&
      (source as Readonly<Record<string, unknown>>).kind !== "system") ||
    typeof (source as Readonly<Record<string, unknown>>).id !== "string" ||
    (source as Readonly<Record<string, unknown>>).id === ""
  ) {
    return throwInvalidBattleReference("Battle effect source is invalid", `${path}.payload.source`)
  }
  const sourceRecord = source as Readonly<Record<string, unknown>>
  return Object.freeze({
    kind: sourceRecord.kind as "item" | "ability" | "system",
    id: sourceRecord.id as string,
  })
}

type CanonicalBattleEffect = Readonly<{
  effect: WizEffect
  initialTurns: number
}>

const resolveCanonicalBattleEffect = (
  instanceId: string,
  source: WizBattleEffectSource,
  content: WizEngineBattleContentResolver | undefined,
  config: WizEffectConfig,
): CanonicalBattleEffect | undefined => {
  if (source.kind === "system") {
    if (instanceId.startsWith("defend-")) {
      return Object.freeze({
        effect: createBattleEffect({
          instanceId,
          effectId: "defending",
          source,
          name: "Defending",
          lifetime: { type: "turns", remaining: 1 },
        }),
        initialTurns: 1,
      })
    }
    if (instanceId.startsWith("fled-")) {
      return Object.freeze({
        effect: createBattleEffect({
          instanceId,
          effectId: "fled",
          source,
          name: "Fled",
          lifetime: { type: "permanent" },
        }),
        initialTurns: -1,
      })
    }
    return undefined
  }

  if (source.kind === "item") {
    const item = content?.resolveItem(source.id)
    if (!item) return undefined
    const buff = getBattleItemBuff(item)
    if (!buff) return undefined
    return Object.freeze({
      effect: createBattleEffect({
        instanceId,
        effectId: buff.effectId,
        source,
        name: item.name,
        lifetime: { type: "turns", remaining: buff.duration },
        power: buff.power,
        modifier: buff.modifier,
        custom: item.custom,
      }),
      initialTurns: buff.duration,
    })
  }

  const ability = content?.resolveAbility(source.id)
  if (!ability || ability.effect.type !== "effect") return undefined
  const effectId = getBattleAbilityEffectId(ability)
  const initialTurns = ability.effect.durationTurns ?? getBattleEffectInitialTurns(effectId, config)
  return Object.freeze({
    effect: createBattleEffect({
      instanceId,
      effectId,
      source,
      name: ability.name,
      lifetime: { type: "turns", remaining: initialTurns },
      power: ability.effect.power,
      modifier: ability.effect.modifier,
      tags: ability.effect.tags,
      custom: ability.custom,
    }),
    initialTurns,
  })
}

const hasCanonicalEffectInstanceId = (
  instanceId: string,
  actorId: string,
  source: WizBattleEffectSource,
): boolean =>
  source.kind === "system"
    ? instanceId.startsWith(`defend-${actorId}-`) || instanceId.startsWith(`fled-${actorId}-`)
    : instanceId.startsWith(
        source.kind === "item" ? `${source.id}-buff-${actorId}-` : `${source.id}-${actorId}-`,
      )

const restoreBattleEffects = <TArrays extends WorldContentArrays>(
  data: readonly WizDeepReadonly<BattleEffectData>[],
  actorId: string,
  path: string,
  context: RestoreContext<TArrays>,
): WizEffectSet => {
  const ids = new Set<string>()
  return WizEffectSet.create(
    data.map((effect, index): WizEffect => {
      const effectPath = `${path}[${index}]`
      if (ids.has(effect.instanceId)) {
        throwInvalidBattleReference(
          `Battle effect "${effect.instanceId}" is duplicated`,
          `${effectPath}.instanceId`,
          effect.instanceId,
        )
      }
      ids.add(effect.instanceId)
      const source = readBattleEffectSource(effect.payload, effectPath)
      const canonical = resolveCanonicalBattleEffect(
        effect.instanceId,
        source,
        context.battleContent,
        context.effectConfig ?? DEFAULT_EFFECT_CONFIG,
      )
      if (
        canonical === undefined ||
        !hasCanonicalEffectInstanceId(effect.instanceId, actorId, source)
      ) {
        return throwInvalidBattleReference(
          `Battle effect "${effect.instanceId}" does not match current content`,
          effectPath,
          effect.instanceId,
        )
      }
      const { lifetime: _savedLifetime, ...savedStatic } = effect
      const { lifetime: _canonicalLifetime, ...canonicalStatic } = canonical.effect.toProperties()
      if (!areBattleSnapshotValuesEqual(savedStatic, canonicalStatic)) {
        return throwInvalidBattleReference(
          `Battle effect "${effect.instanceId}" does not match current content`,
          effectPath,
          effect.instanceId,
        )
      }
      if (
        canonical.initialTurns === -1
          ? effect.lifetime.type !== "permanent"
          : effect.lifetime.type !== "turns" || effect.lifetime.remaining > canonical.initialTurns
      ) {
        return throwInvalidBattleReference(
          `Battle effect "${effect.instanceId}" duration exceeds its canonical definition`,
          `${effectPath}.lifetime`,
          effect.instanceId,
        )
      }
      return canonical.effect.withLifetime(effect.lifetime)
    }),
  )
}

const assertBattleStatusMatches = (
  saved: BattleStatusData,
  canonical: WizBattleActorState,
  path: string,
  referenceId: string,
  currentResourcesMustMatch: boolean,
): void => {
  const canonicalStatus = captureBattleStatus(canonical)
  assertCanonicalBattleValue(
    saved.attributes,
    canonicalStatus.attributes,
    `${path}.attributes`,
    referenceId,
  )
  assertCanonicalBattleValue(
    saved.resources.health.maximum,
    canonicalStatus.resources.health.maximum,
    `${path}.resources.health.maximum`,
    referenceId,
  )
  assertCanonicalBattleValue(
    saved.resources.mana.maximum,
    canonicalStatus.resources.mana.maximum,
    `${path}.resources.mana.maximum`,
    referenceId,
  )
  assertCanonicalBattleValue(saved.custom, canonicalStatus.custom, `${path}.custom`, referenceId)
  if (currentResourcesMustMatch) {
    assertCanonicalBattleValue(
      saved.resources.health.current,
      canonicalStatus.resources.health.current,
      `${path}.resources.health.current`,
      referenceId,
    )
    assertCanonicalBattleValue(
      saved.resources.mana.current,
      canonicalStatus.resources.mana.current,
      `${path}.resources.mana.current`,
      referenceId,
    )
  }
}

const assertBattleEntityCorrelations = (
  data: WizDeepReadonly<BattleContextData>,
  vault: WizVaultValue,
  canonicalMonsters: WizVaultValue["areas"][number]["monsters"],
): void => {
  if (data.party.id !== "party") {
    throwInvalidBattleReference(
      'Battle party ID must remain "party"',
      `${BATTLE_CONTEXT_PATH}.party.id`,
      data.party.id,
    )
  }
  if (data.enemies.id !== "enemies") {
    throwInvalidBattleReference(
      'Battle enemy party ID must remain "enemies"',
      `${BATTLE_CONTEXT_PATH}.enemies.id`,
      data.enemies.id,
    )
  }
  if (data.initiative !== "none") {
    throwInvalidBattleReference(
      "Standard battle initiative must remain canonical",
      `${BATTLE_CONTEXT_PATH}.initiative`,
      data.initiative,
    )
  }

  const encounterLog = [...vault.log].reverse().find((entry) => entry.key === "ENCOUNTER_MONSTERS")
  if (encounterLog?.key === "ENCOUNTER_MONSTERS") {
    const expectedGroups = new Map<string, number>()
    for (const monsterId of encounterLog.monsterIds) {
      expectedGroups.set(monsterId, (expectedGroups.get(monsterId) ?? 0) + 1)
    }
    if (data.enemies.groups.length !== expectedGroups.size) {
      throwInvalidBattleReference(
        "Battle monster groups do not match the recorded encounter roster",
        `${BATTLE_CONTEXT_PATH}.enemies.groups`,
      )
    }
    for (const [groupIndex, [monsterId, count]] of [...expectedGroups].entries()) {
      const groupPath = `${BATTLE_CONTEXT_PATH}.enemies.groups[${groupIndex}]`
      const group = data.enemies.groups[groupIndex]
      if (group?.id !== monsterId) {
        throwInvalidBattleReference(
          "Battle monster group order does not match the recorded encounter roster",
          `${groupPath}.id`,
          group?.id,
        )
      }
      if (group.members.length !== count) {
        throwInvalidBattleReference(
          `Battle monster group "${monsterId}" member count does not match the recorded encounter roster`,
          `${groupPath}.members`,
          monsterId,
        )
      }
    }
  }

  const canonicalPartyIds = new Set(["player", ...vault.partyMembers.map((member) => member.id)])
  const actorPaths = new Map<string, string>()
  for (const [index, member] of data.party.members.entries()) {
    const path = `${BATTLE_CONTEXT_PATH}.party.members[${index}].id`
    if (!canonicalPartyIds.has(member.id)) {
      requireReference(undefined, path, member.id)
    }
    const firstPath = actorPaths.get(member.id)
    if (firstPath) {
      throwInvalidBattleReference(
        `Battle actor "${member.id}" is duplicated; first declared at ${firstPath}`,
        path,
        member.id,
      )
    }
    actorPaths.set(member.id, path)
  }
  if (!actorPaths.has("player")) {
    throwInvalidBattleReference(
      'Battle party must contain the canonical "player" actor',
      `${BATTLE_CONTEXT_PATH}.party.members`,
      "player",
    )
  }

  const groupPaths = new Map<string, string>()
  let monsterIndex = 0
  for (const [groupIndex, group] of data.enemies.groups.entries()) {
    const groupPath = `${BATTLE_CONTEXT_PATH}.enemies.groups[${groupIndex}]`
    const previousGroupPath = groupPaths.get(group.id)
    if (previousGroupPath) {
      throwInvalidBattleReference(
        `Battle monster group "${group.id}" is duplicated; first declared at ${previousGroupPath}.id`,
        `${groupPath}.id`,
        group.id,
      )
    }
    groupPaths.set(group.id, groupPath)

    const canonicalMonster = requireReference(
      canonicalMonsters.find((monster) => monster.id === group.id),
      `${groupPath}.id`,
      group.id,
    )
    if (group.name !== canonicalMonster.name) {
      throwInvalidBattleReference(
        `Battle monster group "${group.id}" name does not match current content`,
        `${groupPath}.name`,
        group.id,
      )
    }

    for (const [memberIndex, member] of group.members.entries()) {
      const memberPath = `${groupPath}.members[${memberIndex}]`
      if (member.groupId !== group.id) {
        throwInvalidBattleReference(
          `Battle monster "${member.id}" references a different monster group`,
          `${memberPath}.groupId`,
          member.groupId,
        )
      }
      if (member.name !== canonicalMonster.name) {
        throwInvalidBattleReference(
          `Battle monster "${member.id}" name does not match group "${group.id}"`,
          `${memberPath}.name`,
          group.id,
        )
      }
      const expectedActorId = `${group.id}_${monsterIndex}`
      if (member.id !== expectedActorId) {
        throwInvalidBattleReference(
          `Battle monster actor "${member.id}" does not match canonical encounter actor "${expectedActorId}"`,
          `${memberPath}.id`,
          member.id,
        )
      }
      monsterIndex += 1
      const actorPath = `${memberPath}.id`
      const firstPath = actorPaths.get(member.id)
      if (firstPath) {
        throwInvalidBattleReference(
          `Battle actor "${member.id}" is duplicated; first declared at ${firstPath}`,
          actorPath,
          member.id,
        )
      }
      actorPaths.set(member.id, actorPath)
    }
  }
}

const restoreCanonicalBattleParty = <TArrays extends WorldContentArrays>(
  data: WizDeepReadonly<BattleContextData["party"]>,
  context: RestoreContext<TArrays>,
): WizBattleParty => {
  const authority =
    context.battleCharacterAuthority ??
    WizSceneBattleCharacterAdapter.createDefault(context.content)
  const canonicalActors = new Map(
    authority.actorsFromVault(context.vault.toPlain()).map((actor) => [actor.id, actor] as const),
  )
  return new WizBattleParty({
    id: "party",
    members: data.members.map((member, index) => {
      const memberPath = `${BATTLE_CONTEXT_PATH}.party.members[${index}]`
      const canonical = requireReference(
        canonicalActors.get(member.id),
        `${memberPath}.id`,
        member.id,
      )
      assertCanonicalBattleValue(member.name, canonical.name, `${memberPath}.name`, member.id)
      assertCanonicalBattleValue(member.custom, canonical.custom, `${memberPath}.custom`, member.id)
      assertBattleStatusMatches(
        member.status,
        canonical.status,
        `${memberPath}.status`,
        member.id,
        true,
      )
      return new WizBattleCharacter({
        id: canonical.id,
        name: canonical.name,
        custom: canonical.custom,
        status: canonical.status,
        effects: restoreBattleEffects(member.effects, member.id, `${memberPath}.effects`, context),
      })
    }),
  })
}

const restoreCanonicalBattleEnemies = <TArrays extends WorldContentArrays>(
  data: WizDeepReadonly<BattleContextData["enemies"]>,
  canonicalMonsters: WizVaultValue["areas"][number]["monsters"],
  context: RestoreContext<TArrays>,
): WizBattleEnemyParty => {
  const definitions = data.groups.map((group, groupIndex) =>
    requireReference(
      canonicalMonsters.find((monster) => monster.id === group.id),
      `${BATTLE_CONTEXT_PATH}.enemies.groups[${groupIndex}].id`,
      group.id,
    ),
  )
  const encounterMonsters = definitions.flatMap((definition, groupIndex) =>
    Array.from({ length: data.groups[groupIndex].members.length }, () => definition),
  )
  const authority = context.battleMonsterAuthority ?? WizSceneBattleMonsterAdapter.createDefault()
  const canonicalEnemies = authority.enemiesFromMonsters(encounterMonsters)

  return new WizBattleEnemyParty({
    id: "enemies",
    groups: data.groups.map((group, groupIndex) => {
      const groupPath = `${BATTLE_CONTEXT_PATH}.enemies.groups[${groupIndex}]`
      const canonicalGroup = requireReference(
        canonicalEnemies.getGroupById(group.id),
        `${groupPath}.id`,
        group.id,
      )
      return new WizBattleMonsterGroup({
        id: canonicalGroup.id,
        name: canonicalGroup.name,
        members: group.members.map((member, memberIndex) => {
          const memberPath = `${groupPath}.members[${memberIndex}]`
          const canonical = requireReference(
            canonicalGroup.members[memberIndex],
            `${memberPath}.id`,
            member.id,
          )
          assertCanonicalBattleValue(member.name, canonical.name, `${memberPath}.name`, member.id)
          assertCanonicalBattleValue(
            member.custom,
            canonical.custom,
            `${memberPath}.custom`,
            member.id,
          )
          assertBattleStatusMatches(
            member.status,
            canonical.status,
            `${memberPath}.status`,
            member.id,
            false,
          )
          if (
            member.status.resources.health.current < 0 ||
            member.status.resources.health.current > canonical.status.resources.maximum("health")
          ) {
            throwInvalidBattleReference(
              `Battle monster "${member.id}" HP is outside its canonical bounds`,
              `${memberPath}.status.resources.health.current`,
              member.id,
            )
          }
          if (
            member.status.resources.mana.current < 0 ||
            member.status.resources.mana.current > canonical.status.resources.maximum("mana")
          ) {
            throwInvalidBattleReference(
              `Battle monster "${member.id}" MP is outside its canonical bounds`,
              `${memberPath}.status.resources.mana.current`,
              member.id,
            )
          }
          const status = WizBattleActorState.fromComponents({
            ...canonical.status.toProperties(),
            resources: canonical.status.resources
              .withCurrent("health", member.status.resources.health.current)
              .withCurrent("mana", member.status.resources.mana.current),
          })
          return new WizBattleMonster({
            id: canonical.id,
            name: canonical.name,
            custom: canonical.custom,
            status,
            effects: restoreBattleEffects(
              member.effects,
              member.id,
              `${memberPath}.effects`,
              context,
            ),
            groupId: canonical.groupId,
          })
        }),
      })
    }),
  })
}

const assertBattleActionDefinitionFields = (
  data: WizDeepReadonly<BattleTurnActionData>,
  path: string,
): void => {
  if (data.type === "ability") {
    if (data.abilityId === null) {
      throwInvalidBattleReference("Battle ability action requires abilityId", `${path}.abilityId`)
    }
    if (data.itemId !== null) {
      throwInvalidBattleReference("Battle ability action cannot contain itemId", `${path}.itemId`)
    }
    return
  }
  if (data.type === "item") {
    if (data.itemId === null) {
      throwInvalidBattleReference("Battle item action requires itemId", `${path}.itemId`)
    }
    if (data.abilityId !== null) {
      throwInvalidBattleReference(
        "Battle item action cannot contain abilityId",
        `${path}.abilityId`,
      )
    }
    return
  }
  if (data.abilityId !== null) {
    throwInvalidBattleReference(
      `Battle ${data.type} action cannot contain abilityId`,
      `${path}.abilityId`,
    )
  }
  if (data.itemId !== null) {
    throwInvalidBattleReference(
      `Battle ${data.type} action cannot contain itemId`,
      `${path}.itemId`,
    )
  }
}

const restoreBattleAction = (
  data: WizDeepReadonly<BattleTurnActionData>,
  path: string,
  context: WizEngineBattleContext,
  content: WizEngineBattleContentResolver | undefined,
): WizEngineBattleTurnAction => {
  assertBattleActionDefinitionFields(data, path)
  requireReference(context.getActorById(data.actorId), `${path}.actorId`, data.actorId)

  const targetIds = new Set<string>()
  for (const [index, targetId] of data.targetIds.entries()) {
    if (targetIds.has(targetId)) {
      throwInvalidBattleReference(
        `Battle action target "${targetId}" is duplicated`,
        `${path}.targetIds[${index}]`,
        targetId,
      )
    }
    targetIds.add(targetId)
    requireReference(context.getActorById(targetId), `${path}.targetIds[${index}]`, targetId)
  }
  if (
    (data.type === "attack" || data.type === "ability" || data.type === "item") &&
    data.targetIds.length === 0
  ) {
    throwInvalidBattleReference(`Battle ${data.type} action requires a target`, `${path}.targetIds`)
  }
  if (
    data.type === "defend" &&
    (data.targetIds.length !== 1 || data.targetIds[0] !== data.actorId)
  ) {
    throwInvalidBattleReference(
      "Battle defend action must target its actor",
      `${path}.targetIds`,
      data.actorId,
    )
  }
  if (data.type === "flee" && data.targetIds.length !== 0) {
    throwInvalidBattleReference("Battle flee action cannot contain targets", `${path}.targetIds`)
  }

  if (data.type === "ability") {
    const abilityId = requireReference(
      data.abilityId ?? undefined,
      `${path}.abilityId`,
      "abilityId",
    )
    requireReference(content?.resolveAbility(abilityId), `${path}.abilityId`, abilityId)
  }
  if (data.type === "item") {
    const itemId = requireReference(data.itemId ?? undefined, `${path}.itemId`, "itemId")
    requireReference(content?.resolveItem(itemId), `${path}.itemId`, itemId)
  }

  const action = WizEngineBattleTurnAction.fromUnknown({
    id: data.id,
    type: data.type,
    actorId: data.actorId,
    targetIds: data.targetIds,
    abilityId: data.abilityId,
    itemId: data.itemId,
  })
  if (!resolveCanonicalBattleAction(action, content)) {
    throwInvalidBattleReference(
      `Battle action "${data.id}" cannot be resolved from current content`,
      path,
      data.id,
    )
  }
  return action
}

const restoreBattleContext = <TArrays extends WorldContentArrays>(
  data: WizDeepReadonly<BattleContextData>,
  dependencies: RestoreContext<TArrays>,
  canonicalMonsters: WizVaultValue["areas"][number]["monsters"],
): WizEngineBattleContext => {
  assertBattleEntityCorrelations(data, dependencies.vault, canonicalMonsters)
  const party = restoreCanonicalBattleParty(data.party, dependencies)
  const enemies = restoreCanonicalBattleEnemies(data.enemies, canonicalMonsters, dependencies)
  const referenceContext = new WizEngineBattleContext({
    id: data.id,
    turnNumber: data.turnNumber,
    party,
    enemies,
    executedActions: [],
    initiative: data.initiative,
  })
  const actionIds = new Map<string, string>()
  const actionActors = new Map<string, string>()
  const restoreExecutedActions = (
    actions: readonly WizDeepReadonly<BattleTurnActionData>[],
  ): readonly WizEngineBattleTurnAction[] =>
    actions.map((action, index) => {
      const path = `${BATTLE_CONTEXT_PATH}.executedActions[${index}]`
      const firstIdPath = actionIds.get(action.id)
      if (firstIdPath) {
        throwInvalidBattleReference(
          `Battle action ID "${action.id}" is duplicated; first declared at ${firstIdPath}.id`,
          `${path}.id`,
          action.id,
        )
      }
      actionIds.set(action.id, path)
      const firstActorPath = actionActors.get(action.actorId)
      if (firstActorPath) {
        throwInvalidBattleReference(
          `Battle actor "${action.actorId}" has multiple actions; first declared at ${firstActorPath}.actorId`,
          `${path}.actorId`,
          action.actorId,
        )
      }
      actionActors.set(action.actorId, path)
      return restoreBattleAction(action, path, referenceContext, dependencies.battleContent)
    })

  return new WizEngineBattleContext({
    id: data.id,
    turnNumber: data.turnNumber,
    party,
    enemies,
    executedActions: restoreExecutedActions(data.executedActions),
    initiative: data.initiative,
  })
}

const restoreBattlePhase = <TRewardCustom, TArrays extends WorldContentArrays>(
  data: WizDeepReadonly<BattlePhaseData<TRewardCustom>>,
  dependencies: RestoreContext<TArrays>,
  canonicalMonsters: WizVaultValue["areas"][number]["monsters"],
): WizStateBattle<unknown, unknown, TRewardCustom>["phase"] => {
  const context = restoreBattleContext(data.context, dependencies, canonicalMonsters)
  if (data.phase === "encounter") {
    return new WizEngineBattleEncounter({ context })
  }
  if (data.phase === "turnOrder") {
    const actorIds = new Set<string>()
    const turnOrder = data.turnOrder.map((actor, index) => {
      if (actorIds.has(actor.actorId)) {
        throwInvalidBattleReference(
          `Battle turn order actor "${actor.actorId}" is duplicated`,
          `$.scene.phase.turnOrder[${index}].actorId`,
          actor.actorId,
        )
      }
      actorIds.add(actor.actorId)
      const entity = requireReference(
        context.getActorById(actor.actorId),
        `$.scene.phase.turnOrder[${index}].actorId`,
        actor.actorId,
      )
      return {
        id: entity.id,
        name: entity.name,
        speed: context.getActorSpeed(entity.id),
        isEnemy: context.enemies.getMonsterById(entity.id) !== undefined,
      }
    })
    if (data.currentActorIndex > turnOrder.length) {
      throw new WizStandardSessionError(
        "SCENE_REFERENCE_INVALID",
        "Battle currentActorIndex exceeds the restored turn order",
        "$.scene.phase.currentActorIndex",
      )
    }
    let executedOrderIndex = 0
    for (const [actionIndex, action] of context.executedActions.entries()) {
      const turnOrderIndex = turnOrder.findIndex(
        (actor, index) => index >= executedOrderIndex && actor.id === action.actorId,
      )
      if (turnOrderIndex < 0 || turnOrderIndex >= data.currentActorIndex) {
        throwInvalidBattleReference(
          `Executed battle action actor "${action.actorId}" is not in the processed turn-order prefix`,
          `${BATTLE_CONTEXT_PATH}.executedActions[${actionIndex}].actorId`,
          action.actorId,
        )
      }
      executedOrderIndex = turnOrderIndex + 1
    }
    return new WizEngineBattlePhaseTurnOrder({
      context,
      turnOrder,
      currentActorIndex: data.currentActorIndex,
    })
  }
  if (data.phase === "defeat") {
    return new WizEngineBattlePhaseDefeat({ context })
  }
  const reward = data.reward
    ? new WizEngineBattleReward<TRewardCustom>({
        experience: data.reward.experience,
        gold: data.reward.gold,
        droppedItems: data.reward.droppedItems,
        custom: data.reward.custom as WizDeepReadonly<TRewardCustom>,
      })
    : undefined
  return new WizEngineBattlePhaseVictory<unknown, unknown, TRewardCustom>({
    context,
    ...(reward ? { reward } : {}),
  })
}

const restoreBuiltInScene = <TRewardCustom, TArrays extends WorldContentArrays>(
  scene: WizDeepReadonly<WizStandardBuiltInSceneSnapshotData<TRewardCustom>>,
  context: RestoreContext<TArrays>,
): WizState<unknown, unknown, TRewardCustom> => {
  const { vault } = context
  switch (scene.type) {
    case "village":
      return new WizStateVillage({
        type: "village",
        selectedAction: scene.selectedAction,
        vault,
      })
    case "shop":
      const canonicalShopDialogue =
        context.shopDialogues === undefined
          ? undefined
          : requireReference(
              context.shopDialogues.getDialogue(scene.shopId) ?? undefined,
              "$.scene.shopId",
              scene.shopId,
            )
      const canonicalBuyPriceModifier = canonicalShopDialogue?.buyPriceModifier ?? 1
      if (scene.buyPriceModifier !== canonicalBuyPriceModifier) {
        throw new WizStandardSessionError(
          "SCENE_REFERENCE_INVALID",
          `Shop price modifier for "${scene.shopId}" does not match current content`,
          "$.scene.buyPriceModifier",
          scene.shopId,
        )
      }
      const pendingPurchase = restoreShopPurchase(
        scene.pendingPurchase,
        canonicalBuyPriceModifier,
        context.content,
        canonicalShopDialogue?.products,
      )
      assertShopPurchaseMessageCorrelation(scene.message, pendingPurchase)
      return new WizStateShop({
        type: "shop",
        shopId: scene.shopId,
        buyPriceModifier: canonicalBuyPriceModifier,
        pendingPurchase,
        message: scene.message,
        conversation: restoreShopConversation(
          scene.conversation,
          scene.shopId,
          context.shopDialogues,
          "$.scene.conversation",
        ),
        lastConversation: restoreShopConversation(
          scene.lastConversation,
          scene.shopId,
          context.shopDialogues,
          "$.scene.lastConversation",
        ),
        vault,
      })
    case "inn":
      if (scene.selectedPlan !== null) {
        requireReference(
          context.content.arrays.innPlans.find((plan) => plan.id === scene.selectedPlan),
          "$.scene.selectedPlan",
          scene.selectedPlan,
        )
      }
      return new WizStateInn({
        type: "inn",
        selectedPlan: scene.selectedPlan,
        confirmingStay: scene.confirmingStay,
        message: scene.message,
        vault,
      })
    case "exploration":
      const area = requireUnlockedArea(vault, scene.areaId, "$.scene.areaId")
      return new WizStateExploration({
        type: "exploration",
        areaId: scene.areaId,
        eventProgress: restoreExplorationProgress(scene.eventProgress, area.events),
        message: scene.message,
        vault,
      })
    case "battle":
      const returnArea = requireUnlockedArea(vault, scene.returnAreaId, "$.scene.returnAreaId")
      return new WizStateBattle<unknown, unknown, TRewardCustom>({
        type: "battle",
        phase: restoreBattlePhase(scene.phase, context, returnArea.monsters),
        returnAreaId: scene.returnAreaId,
        vault,
      })
    case "conversation":
      return restoreConversationState(scene, vault)
    case "crafting": {
      const selectedRecipe =
        scene.selectedRecipeId === null
          ? null
          : requireReference(
              context.resolveRecipe?.(scene.selectedRecipeId),
              "$.scene.selectedRecipeId",
              scene.selectedRecipeId,
            )
      return new WizStateCrafting({
        type: "crafting",
        selectedRecipe,
        confirmingCraft: scene.confirmingCraft,
        result: scene.result,
        message: scene.message,
        vault,
        availableFacilities: vault.unlockedFacilities,
      })
    }
    case "quest": {
      const selectedQuest =
        scene.selectedQuestId === null
          ? null
          : requireReference(
              vault.quests.find((candidate) => candidate.id === scene.selectedQuestId),
              "$.scene.selectedQuestId",
              scene.selectedQuestId,
            )
      return new WizStateQuest({
        type: "quest",
        selectedQuest,
        message: scene.message,
        vault,
      })
    }
    case "level_up":
      if (vault.player.exp < vault.player.expToNextLevel) {
        throw new WizStandardSessionError(
          "SCENE_REFERENCE_INVALID",
          "Level-up scene requires the current player to have enough experience",
          "$.scene.type",
        )
      }
      if (scene.returnAreaId !== null) {
        requireUnlockedArea(vault, scene.returnAreaId, "$.scene.returnAreaId")
      }
      const levelUpPointsPerLevel =
        context.levelUpPointsPerLevel ?? DEFAULT_LEVEL_UP_CONFIG.pointsPerLevelUp
      const pendingPointTotal = Object.values(scene.pendingAttributes).reduce<number>(
        (total, points) => total + (points ?? 0),
        0,
      )
      const canonicalAvailablePoints = levelUpPointsPerLevel - pendingPointTotal
      if (canonicalAvailablePoints < 0 || scene.availablePoints !== canonicalAvailablePoints) {
        throw new WizStandardSessionError(
          "SCENE_REFERENCE_INVALID",
          "Level-up allocation does not match the configured point budget",
          "$.scene.availablePoints",
        )
      }
      return new WizStateLevelUp({
        type: "level_up",
        availablePoints: canonicalAvailablePoints,
        pendingAttributes: scene.pendingAttributes,
        returnAreaId: scene.returnAreaId,
        vault,
      })
  }
}

/**
 * standard sessionをversion envelopeへ変換し、unknown入力を検証する不変codec。
 */
export class WizStandardSessionCodec<
  TExtraState extends WizStandardSessionPluginSceneState = never,
  TPluginData extends object = object,
  TPluginScene extends WizStandardPluginSceneSnapshotData<TPluginData> =
    WizStandardPluginSceneSnapshotData<TPluginData>,
  TArrays extends WorldContentArrays = WorldContentArrays,
  TRewardCustom = undefined,
  TRewardCustomInput = TRewardCustom,
> {
  readonly #findPluginSceneCodec: PluginSceneCodecLookup
  readonly contentVersion: string
  readonly schemaVersion: number
  private readonly worldCodec: WizWorldSaveCodec<
    WizDeepReadonly<
      WizStandardSessionData<TPluginData, TPluginScene, WorldSnapshotData, TRewardCustomInput>
    >,
    WizStandardSessionData<TPluginData, TPluginScene, WorldSnapshotData, TRewardCustomInput>
  >
  readonly #rewardCustomCodec: WizStandardRewardCustomCodec<TRewardCustom, TRewardCustomInput>
  /** Prevents unrelated plugin-state codecs from becoming structurally interchangeable. */
  declare private readonly extraStateInvariant: (state: TExtraState) => TExtraState
  /** Prevents heterogeneous plugin content requirements from being widened during inference. */
  declare private readonly contentInvariant: (content: TArrays) => TArrays
  declare readonly [pluginSceneContentType]: TArrays

  private constructor(
    token: symbol,
    options: WizStandardSessionCodecBaseOptions,
    pluginScenes: readonly PluginSceneCodecRuntime[],
    rewardCustomCodec: WizStandardRewardCustomCodec<TRewardCustom, TRewardCustomInput>,
  ) {
    assertStandardSessionConstructionToken(token)
    for (const codec of pluginScenes) {
      WizStandardSceneName.assertPlugin(codec.type)
    }
    const duplicate = pluginScenes.find(
      (codec, index) =>
        pluginScenes.findIndex((candidate) => candidate.type === codec.type) !== index,
    )
    if (duplicate) {
      throw new RangeError(`Duplicate plugin scene codec "${duplicate.type}"`)
    }
    this.worldCodec = WizWorldSaveCodec.define({
      contentVersion: options.contentVersion,
      schemaVersion: WIZ_STANDARD_SESSION_SCHEMA_VERSION,
      schema: zWizStandardSessionData as z.ZodType<
        WizStandardSessionData<TPluginData, TPluginScene, WorldSnapshotData, TRewardCustomInput>,
        WizDeepReadonly<
          WizStandardSessionData<TPluginData, TPluginScene, WorldSnapshotData, TRewardCustomInput>
        >
      >,
    })
    this.#rewardCustomCodec = rewardCustomCodec
    this.contentVersion = this.worldCodec.contentVersion
    this.schemaVersion = this.worldCodec.schemaVersion
    this.#findPluginSceneCodec = createPluginSceneCodecLookup(pluginScenes)
    Object.freeze(this)
  }

  static create(
    options: WizStandardSessionCodecBaseOptions &
      Readonly<{
        pluginScenes?: undefined
        rewardCustom?: undefined
      }>,
  ): WizStandardSessionCodec<never, object, never, WorldContentArrays, undefined>
  static create<const TPluginCodecs extends readonly WizStandardPluginSceneCodecValue[]>(
    options: WizStandardSessionCodecBaseOptions &
      Readonly<{
        pluginScenes: TPluginCodecs
        rewardCustom?: undefined
      }>,
  ): WizStandardSessionCodec<
    PluginStateOf<TPluginCodecs[number]>,
    PluginDataOf<TPluginCodecs[number]>,
    PluginSceneSnapshotOf<TPluginCodecs[number]>,
    PluginContentOf<TPluginCodecs[number]>,
    undefined
  >
  static create<const TRewardCustomCodec extends RewardCustomCodecValue>(
    options: WizStandardSessionCodecBaseOptions &
      Readonly<{
        pluginScenes?: undefined
        rewardCustom: TRewardCustomCodec
      }>,
  ): WizStandardSessionCodec<
    never,
    object,
    never,
    WorldContentArrays,
    RewardCustomOf<TRewardCustomCodec>,
    RewardCustomInputOf<TRewardCustomCodec>
  >
  static create<
    const TPluginCodecs extends readonly WizStandardPluginSceneCodecValue[],
    const TRewardCustomCodec extends RewardCustomCodecValue,
  >(
    options: WizStandardSessionCodecBaseOptions &
      Readonly<{
        pluginScenes: TPluginCodecs
        rewardCustom: TRewardCustomCodec
      }>,
  ): WizStandardSessionCodec<
    PluginStateOf<TPluginCodecs[number]>,
    PluginDataOf<TPluginCodecs[number]>,
    PluginSceneSnapshotOf<TPluginCodecs[number]>,
    PluginContentOf<TPluginCodecs[number]>,
    RewardCustomOf<TRewardCustomCodec>,
    RewardCustomInputOf<TRewardCustomCodec>
  >
  static create(
    options: WizStandardSessionCodecOptions<
      readonly WizStandardPluginSceneCodecValue[],
      RewardCustomCodecValue | undefined
    >,
  ): unknown {
    const pluginSceneValues = options.pluginScenes ?? []
    const pluginScenes = pluginSceneValues.map((codec) => {
      if (!isAuthenticPluginSceneCodec(codec)) {
        throw new TypeError(
          "Standard session plugin codecs must be created by WizStandardPluginSceneCodec.define()",
        )
      }
      return codec
    })
    const rewardCustomCodec = options.rewardCustom ?? undefinedRewardCustomCodec
    if (!authenticRewardCustomCodecs.has(rewardCustomCodec)) {
      throw new TypeError(
        "Standard session reward custom codecs must be created by WizStandardRewardCustomCodec.define()",
      )
    }
    return new WizStandardSessionCodec(
      standardSessionConstructionToken,
      options,
      pluginScenes,
      rewardCustomCodec as WizStandardRewardCustomCodec<never, unknown>,
    )
  }

  capture<const TWorldData extends WorldSnapshotData>(
    state: TExtraState,
    world: WorldSnapshot<TWorldData>,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    TWorldData,
    TRewardCustom,
    TRewardCustomInput
  >
  capture<TStatus, TCustom, const TWorldData extends WorldSnapshotData>(
    state: WizState<TStatus, TCustom, TRewardCustom>,
    world: WorldSnapshot<TWorldData>,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    TWorldData,
    TRewardCustom,
    TRewardCustomInput
  >
  capture<TStatus, TCustom, const TWorldData extends WorldSnapshotData>(
    state: WizState<TStatus, TCustom, TRewardCustom> | TExtraState,
    world: WorldSnapshot<TWorldData>,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    TWorldData,
    TRewardCustom,
    TRewardCustomInput
  >
  capture(
    state: TExtraState,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    WorldSnapshotData,
    TRewardCustom,
    TRewardCustomInput
  >
  capture<TStatus, TCustom>(
    state: WizState<TStatus, TCustom, TRewardCustom>,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    WorldSnapshotData,
    TRewardCustom,
    TRewardCustomInput
  >
  capture<TStatus, TCustom>(
    state: WizState<TStatus, TCustom, TRewardCustom> | TExtraState,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    WorldSnapshotData,
    TRewardCustom,
    TRewardCustomInput
  >
  capture<TStatus, TCustom>(
    state: WizState<TStatus, TCustom, TRewardCustom> | TExtraState,
    world: WorldSnapshot = WorldSnapshot.fromVault(state.vault),
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    WorldSnapshotData,
    TRewardCustom,
    TRewardCustomInput
  > {
    return this.captureState(state, world)
  }

  private captureState<TStatus, TCustom, const TWorldData extends WorldSnapshotData>(
    state: WizState<TStatus, TCustom, TRewardCustom> | TExtraState,
    world: WorldSnapshot<TWorldData>,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    TWorldData,
    TRewardCustom,
    TRewardCustomInput
  > {
    const scene = this.captureScene(state)
    const envelope = this.worldCodec.encode({
      world: world.toPlain(),
      scene: scene.wire as WizDeepReadonly<
        WizStandardSceneSnapshotData<TPluginData, TPluginScene, TRewardCustomInput>
      >,
    })
    return new WizStandardSessionSnapshotValue<
      TExtraState,
      TPluginData,
      TPluginScene,
      TWorldData,
      TRewardCustom,
      TRewardCustomInput
    >(
      this,
      envelope as WizWorldSaveEnvelope<
        WizStandardSessionData<TPluginData, TPluginScene, TWorldData, TRewardCustomInput>
      >,
      scene.canonical,
    )
  }

  encode<const TWorldData extends WorldSnapshotData>(
    stateOrSnapshot: WizStandardSessionSnapshot<
      TExtraState,
      TPluginData,
      TPluginScene,
      TWorldData,
      TRewardCustom,
      TRewardCustomInput
    >,
  ): WizWorldSaveEnvelope<
    WizStandardSessionData<
      TPluginData,
      TPluginScene,
      WorldSnapshotCanonicalData<TWorldData>,
      TRewardCustomInput
    >
  >
  encode(
    stateOrSnapshot: TExtraState,
  ): WizWorldSaveEnvelope<
    WizStandardSessionData<TPluginData, TPluginScene, WorldSnapshotData, TRewardCustomInput>
  >
  encode<TStatus, TCustom>(
    stateOrSnapshot: WizState<TStatus, TCustom, TRewardCustom>,
  ): WizWorldSaveEnvelope<
    WizStandardSessionData<TPluginData, TPluginScene, WorldSnapshotData, TRewardCustomInput>
  >
  encode<TStatus, TCustom>(
    stateOrSnapshot: WizState<TStatus, TCustom, TRewardCustom> | TExtraState,
  ): WizWorldSaveEnvelope<
    WizStandardSessionData<TPluginData, TPluginScene, WorldSnapshotData, TRewardCustomInput>
  >
  encode<TStatus, TCustom>(
    stateOrSnapshot:
      | WizState<TStatus, TCustom, TRewardCustom>
      | TExtraState
      | WizStandardSessionSnapshot<
          TExtraState,
          TPluginData,
          TPluginScene,
          WorldSnapshotData,
          TRewardCustom,
          TRewardCustomInput
        >,
  ): WizWorldSaveEnvelope<
    WizStandardSessionData<TPluginData, TPluginScene, WorldSnapshotData, TRewardCustomInput>
  > {
    if (stateOrSnapshot instanceof WizStandardSessionSnapshot) {
      assertStandardSessionSnapshotOwner(stateOrSnapshot, this)
      return stateOrSnapshot.toEnvelope()
    }
    return this.captureState(
      stateOrSnapshot,
      WorldSnapshot.fromVault(stateOrSnapshot.vault),
    ).toEnvelope()
  }

  parse<const TWorldData extends WorldSnapshotData>(
    input: WizStandardSessionSnapshot<
      TExtraState,
      TPluginData,
      TPluginScene,
      TWorldData,
      TRewardCustom,
      TRewardCustomInput
    >,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    TWorldData,
    TRewardCustom,
    TRewardCustomInput
  >
  parse<const TWorldData extends WorldSnapshotData>(
    input: WizWorldSaveEnvelope<
      WizStandardSessionData<TPluginData, TPluginScene, TWorldData, TRewardCustomInput>
    >,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    TWorldData,
    TRewardCustom,
    TRewardCustomInput
  >
  parse(
    input: unknown,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    WorldSnapshotData,
    TRewardCustom,
    TRewardCustomInput
  >
  parse(
    input: unknown,
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    WorldSnapshotData,
    TRewardCustom,
    TRewardCustomInput
  > {
    if (input instanceof WizStandardSessionSnapshot) {
      assertStandardSessionSnapshotOwner(input, this)
      return input as WizStandardSessionSnapshot<
        TExtraState,
        TPluginData,
        TPluginScene,
        WorldSnapshotData,
        TRewardCustom,
        TRewardCustomInput
      >
    }
    const envelope = this.worldCodec.parse(input)
    const canonicalScene = this.decodeScene(envelope.snapshot.scene)
    return new WizStandardSessionSnapshotValue<
      TExtraState,
      TPluginData,
      TPluginScene,
      WorldSnapshotData,
      TRewardCustom,
      TRewardCustomInput
    >(this, envelope, canonicalScene)
  }

  /** @internal StandardWorldのrestore境界だけが使用する。 */
  [restoreStandardSessionScene]<TContentArrays extends WorldContentArrays>(
    snapshot: WizStandardSessionSnapshot<
      TExtraState,
      TPluginData,
      TPluginScene,
      WorldSnapshotData,
      TRewardCustom,
      TRewardCustomInput
    >,
    context: RestoreContext<TContentArrays>,
  ): WizState<unknown, unknown, TRewardCustom> | TExtraState {
    assertStandardSessionSnapshotOwner(snapshot, this)
    const scene =
      (canonicalStandardSessionScenes.get(snapshot) as
        | WizStandardRestorableSceneSnapshotData<TRewardCustom>
        | undefined) ?? this.decodeScene(snapshot.scene)
    if (scene.type !== "plugin") {
      return restoreBuiltInScene(scene, context)
    }
    const codec = this.requirePluginCodec(scene.sceneType)
    return codec[restoreCapturedPluginScene](scene.data, context) as TExtraState
  }

  private decodeScene(
    scene: WizDeepReadonly<
      WizStandardSceneSnapshotData<TPluginData, TPluginScene, TRewardCustomInput>
    >,
  ): WizStandardRestorableSceneSnapshotData<TRewardCustom> {
    if (scene.type === "plugin") {
      const codec = this.requirePluginCodec(scene.sceneType)
      return sessionOwnership.ownImmutable({
        type: "plugin",
        sceneType: scene.sceneType,
        data: codec.parse(scene.data),
      })
    }
    if (
      scene.type !== "battle" ||
      scene.phase.phase !== "victory" ||
      scene.phase.reward === undefined
    ) {
      return scene as WizDeepReadonly<WizStandardBuiltInSceneSnapshotData<TRewardCustom>>
    }
    const custom = this.#rewardCustomCodec.parse(scene.phase.reward.custom)
    return withCapturedBattleRewardCustom(scene, custom)
  }

  private captureScene<TStatus, TCustom>(
    state: WizState<TStatus, TCustom, TRewardCustom> | TExtraState,
  ): WizStandardValidatedCapture<
    WizStandardSceneSnapshotData<TPluginData, TPluginScene, TRewardCustomInput>,
    WizStandardRestorableSceneSnapshotData<TRewardCustom>
  > {
    if (WizStandardSceneName.isBuiltIn(state.type)) {
      const rewardCapture: {
        value?: WizStandardValidatedCapture<TRewardCustomInput, TRewardCustom>
      } = {}
      const wire = sessionOwnership.ownImmutable(
        captureBuiltInScene(state as WizState<TStatus, TCustom, TRewardCustom>, (custom) => {
          const captured = this.#rewardCustomCodec[captureValidatedRewardCustom](custom)
          rewardCapture.value = captured
          return captured.wire
        }),
      ) as WizDeepReadonly<WizStandardBuiltInSceneSnapshotData<TRewardCustomInput>>
      const canonical =
        rewardCapture.value === undefined
          ? (wire as WizDeepReadonly<WizStandardBuiltInSceneSnapshotData<TRewardCustom>>)
          : withCapturedBattleRewardCustom(wire, rewardCapture.value.canonical)
      return Object.freeze({
        canonical: canonical as WizDeepReadonly<
          WizStandardRestorableSceneSnapshotData<TRewardCustom>
        >,
        wire,
      })
    }
    const codec = this.requirePluginCodec(state.type)
    const captured = codec[captureValidatedPluginScene](state)
    const wire = sessionOwnership.ownImmutable({
      type: "plugin",
      sceneType: state.type,
      data: captured.wire,
    }) as WizDeepReadonly<TPluginScene>
    const canonical = sessionOwnership.ownImmutable({
      type: "plugin" as const,
      sceneType: state.type,
      data: captured.canonical,
    }) as WizDeepReadonly<WizStandardRestorableSceneSnapshotData<TRewardCustom>>
    return Object.freeze({ canonical, wire })
  }

  private requirePluginCodec(sceneType: string): PluginSceneCodecRuntime {
    const codec = this.#findPluginSceneCodec(sceneType)
    if (codec) return codec
    throw new WizStandardSessionError(
      "PLUGIN_SCENE_CODEC_MISSING",
      `No plugin scene codec is registered for "${sceneType}"`,
      "$.scene.sceneType",
      sceneType,
    )
  }
}

Object.freeze(WizStandardSessionCodec.prototype)
Object.freeze(WizStandardSessionCodec)

/**
 * StandardWorldだけが使用するsession復元境界。
 *
 * @internal
 */
export const restoreWizStandardSessionScene = <
  TExtraState extends WizStandardSessionPluginSceneState,
  TPluginData extends object,
  TPluginScene extends WizStandardPluginSceneSnapshotData<TPluginData>,
  TCodecArrays extends WorldContentArrays,
  TArrays extends WorldContentArrays,
  TRewardCustom,
  TRewardCustomInput,
>(
  codec: WizStandardSessionCodec<
    TExtraState,
    TPluginData,
    TPluginScene,
    TCodecArrays,
    TRewardCustom,
    TRewardCustomInput
  >,
  snapshot: WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    WorldSnapshotData,
    TRewardCustom,
    TRewardCustomInput
  >,
  context: RestoreContext<TArrays>,
): WizState<unknown, unknown, TRewardCustom> | TExtraState => {
  assertAuthenticStandardSessionSnapshot(snapshot)
  return codec[restoreStandardSessionScene](snapshot, context)
}

export type WizStandardSessionWorld<
  TExtraState extends WizPluginSceneState = never,
  TExtraAction extends WizPluginSceneAction = never,
> = Readonly<{
  readonly state: WizState | TExtraState
  readonly action?: TExtraAction
}>

Object.freeze(WizStandardSessionError.prototype)
Object.freeze(WizStandardSessionError)
