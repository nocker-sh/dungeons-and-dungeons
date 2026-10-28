import type { WorldContentArraysInput } from "@/lib/wiz/core/content/schema"

type ArrayEntry<TArray> = TArray extends readonly (infer TEntry)[] ? TEntry : never

declare const missingWorldContentId: unique symbol
type MissingWorldContentId = string & {
  readonly [missingWorldContentId]: never
}

type IdOf<TArray> = [ArrayEntry<TArray>] extends [never]
  ? MissingWorldContentId
  : ArrayEntry<TArray> extends {
        readonly id: infer TId extends string
      }
    ? TId
    : MissingWorldContentId

type OptionalArray<TInput, TKey extends PropertyKey> = TKey extends keyof TInput
  ? NonNullable<TInput[TKey]>
  : readonly []

type FacilityIdOf<TInput> = [ArrayEntry<OptionalArray<TInput, "facilities">>] extends [never]
  ? MissingWorldContentId
  : ArrayEntry<OptionalArray<TInput, "facilities">> extends {
        readonly facilityId: infer TId extends string
      }
    ? TId
    : MissingWorldContentId

type ItemReference<TEntry, TItemId extends string> = TEntry & {
  readonly itemId: TItemId
}

type RecipeMaterialConstraint<
  TMaterial,
  TItemId extends string,
  TWeaponId extends string,
  TArmorId extends string,
> = TMaterial extends { readonly weaponId: unknown }
  ? TMaterial & { readonly weaponId: TWeaponId }
  : TMaterial extends { readonly armorId: unknown }
    ? TMaterial & { readonly armorId: TArmorId }
    : TMaterial & { readonly itemId: TItemId }

type RecipeResultConstraint<
  TResult,
  TItemId extends string,
  TWeaponId extends string,
  TArmorId extends string,
> = TResult extends { readonly type: "item" }
  ? TResult & { readonly itemId: TItemId }
  : TResult extends { readonly type: "weapon" }
    ? TResult & { readonly weaponId: TWeaponId }
    : TResult extends { readonly type: "armor" }
      ? TResult & { readonly armorId: TArmorId }
      : TResult

type RecipeConstraint<
  TRecipe,
  TItemId extends string,
  TWeaponId extends string,
  TArmorId extends string,
  TFacilityId extends string,
> = TRecipe extends {
  readonly materials: infer TMaterials extends readonly unknown[]
  readonly result: infer TResult
}
  ? TRecipe & {
      readonly materials: TMaterials &
        readonly RecipeMaterialConstraint<ArrayEntry<TMaterials>, TItemId, TWeaponId, TArmorId>[]
      readonly result: RecipeResultConstraint<TResult, TItemId, TWeaponId, TArmorId>
      readonly requiresFacility?: TFacilityId
    }
  : TRecipe

type MonsterConstraint<TMonster, TItemId extends string> = TMonster extends {
  readonly drops: infer TDrops extends readonly unknown[]
}
  ? TMonster & {
      readonly drops: TDrops & readonly ItemReference<ArrayEntry<TDrops>, TItemId>[]
    }
  : TMonster

type EventRewardConstraint<TReward, TItemId extends string> = TReward & {
  readonly items?: readonly ItemReference<
    ArrayEntry<TReward extends { readonly items?: infer TItems } ? NonNullable<TItems> : never>,
    TItemId
  >[]
}

type QuestRewardEntryConstraint<
  TReward,
  TItemId extends string,
  TWeaponId extends string,
  TArmorId extends string,
> = TReward extends { readonly weaponId: unknown }
  ? TReward & { readonly type: "weapon"; readonly weaponId: TWeaponId }
  : TReward extends { readonly armorId: unknown }
    ? TReward & { readonly armorId: TArmorId }
    : TReward & { readonly type: "item"; readonly itemId: TItemId }

type QuestRewardConstraint<
  TReward,
  TItemId extends string,
  TWeaponId extends string,
  TArmorId extends string,
> = TReward & {
  readonly items?: readonly QuestRewardEntryConstraint<
    ArrayEntry<TReward extends { readonly items?: infer TItems } ? NonNullable<TItems> : never>,
    TItemId,
    TWeaponId,
    TArmorId
  >[]
}

type EventChoiceConstraint<TChoice, TItemId extends string> = TChoice & {
  readonly successReward?: EventRewardConstraint<
    TChoice extends { readonly successReward?: infer TReward } ? NonNullable<TReward> : object,
    TItemId
  >
}

type EventConstraint<TEvent, TItemId extends string> = TEvent extends {
  readonly choices: infer TChoices extends readonly unknown[]
}
  ? TEvent & {
      readonly choices: TChoices & readonly EventChoiceConstraint<ArrayEntry<TChoices>, TItemId>[]
    }
  : TEvent

type AreaConstraint<
  TArea,
  TItemId extends string,
  TMonsterId extends string,
  TEventId extends string,
  TAreaId extends string,
> = TArea extends {
  readonly availableGathering: infer TGathering extends readonly unknown[]
  readonly monsterIds: infer TMonsterIds extends readonly unknown[]
  readonly eventIds: infer TEventIds extends readonly unknown[]
}
  ? TArea & {
      readonly availableGathering: TGathering & readonly TItemId[]
      readonly monsterIds: TMonsterIds & readonly TMonsterId[]
      readonly eventIds: TEventIds & readonly TEventId[]
      readonly unlockCondition?: {
        readonly areaId: TAreaId
        readonly requiredProgress: number
      }
    }
  : TArea

type DialogueRequirementsConstraint<TRequirements, TItemId extends string> = TRequirements & {
  readonly requiredItems?: readonly ItemReference<
    ArrayEntry<
      TRequirements extends { readonly requiredItems?: infer TItems } ? NonNullable<TItems> : never
    >,
    TItemId
  >[]
}

type DialogueEffectsConstraint<
  TEffects,
  TItemId extends string,
  TQuestId extends string,
  TDialogueId extends string,
> = TEffects & {
  readonly giveItems?: readonly ItemReference<
    ArrayEntry<
      TEffects extends { readonly giveItems?: infer TItems } ? NonNullable<TItems> : never
    >,
    TItemId
  >[]
  readonly takeItems?: readonly ItemReference<
    ArrayEntry<
      TEffects extends { readonly takeItems?: infer TItems } ? NonNullable<TItems> : never
    >,
    TItemId
  >[]
  readonly startQuest?: TQuestId
  readonly completeQuest?: TQuestId
  readonly unlockDialogue?: TDialogueId
}

type DialogueOptionConstraint<
  TOption,
  TItemId extends string,
  TQuestId extends string,
  TDialogueId extends string,
> = TOption & {
  readonly responseDialogueId?: TDialogueId
  readonly requirements?: DialogueRequirementsConstraint<
    TOption extends { readonly requirements?: infer TRequirements }
      ? NonNullable<TRequirements>
      : object,
    TItemId
  >
  readonly effects?: DialogueEffectsConstraint<
    TOption extends { readonly effects?: infer TEffects } ? NonNullable<TEffects> : object,
    TItemId,
    TQuestId,
    TDialogueId
  >
}

type DialogueConstraint<
  TDialogue,
  TItemId extends string,
  TQuestId extends string,
  TDialogueId extends string,
> = TDialogue & {
  readonly afterQuest?: TQuestId
  readonly triggers?: (TDialogue extends { readonly triggers?: infer TTriggers }
    ? NonNullable<TTriggers>
    : object) & {
    readonly afterQuest?: TQuestId
  }
  readonly requirements?: DialogueRequirementsConstraint<
    TDialogue extends { readonly requirements?: infer TRequirements }
      ? NonNullable<TRequirements>
      : object,
    TItemId
  >
  readonly options?: readonly DialogueOptionConstraint<
    ArrayEntry<
      TDialogue extends { readonly options?: infer TOptions } ? NonNullable<TOptions> : never
    >,
    TItemId,
    TQuestId,
    TDialogueId
  >[]
}

type NpcConstraint<TNpc, TItemId extends string, TQuestId extends string> = TNpc extends {
  readonly likes: infer TLikes extends readonly unknown[]
  readonly dislikes: infer TDislikes extends readonly unknown[]
  readonly dialogues: infer TDialogues extends readonly unknown[]
}
  ? TNpc & {
      readonly likes: TLikes & readonly TItemId[]
      readonly dislikes: TDislikes & readonly TItemId[]
      readonly dialogues: TDialogues &
        readonly DialogueConstraint<ArrayEntry<TDialogues>, TItemId, TQuestId, IdOf<TDialogues>>[]
    }
  : TNpc

type QuestObjectiveConstraint<
  TObjective,
  TItemId extends string,
  TMonsterId extends string,
  TAreaId extends string,
  TNpcId extends string,
> = TObjective extends { readonly type: "defeat" }
  ? TObjective & { readonly monsterId: TMonsterId }
  : TObjective extends { readonly type: "gather" }
    ? TObjective & { readonly itemId: TItemId }
    : TObjective extends { readonly type: "explore" }
      ? TObjective & { readonly areaId: TAreaId }
      : TObjective extends { readonly type: "deliver" }
        ? TObjective & {
            readonly itemId: TItemId
            readonly npcId: TNpcId
          }
        : TObjective

type QuestConstraint<
  TQuest,
  TItemId extends string,
  TWeaponId extends string,
  TArmorId extends string,
  TMonsterId extends string,
  TAreaId extends string,
  TNpcId extends string,
  TQuestId extends string,
> = TQuest extends {
  readonly objective: infer TObjective
  readonly reward: infer TReward
}
  ? TQuest & {
      readonly giverNpcId: TNpcId
      readonly objective: QuestObjectiveConstraint<TObjective, TItemId, TMonsterId, TAreaId, TNpcId>
      readonly reward: QuestRewardConstraint<TReward, TItemId, TWeaponId, TArmorId>
      readonly nextQuestId?: TQuestId
    }
  : TQuest

type FacilityConstraint<
  TFacility,
  TAreaId extends string,
  TQuestId extends string,
> = TFacility extends { readonly type: "area_progress" }
  ? TFacility & { readonly areaId: TAreaId }
  : TFacility extends { readonly type: "quest" }
    ? TFacility & { readonly questId: TQuestId }
    : TFacility

type ShopTopicConstraint<TTopic, TItemId extends string> = TTopic & {
  readonly condition?: (TTopic extends { readonly condition?: infer TCondition }
    ? NonNullable<TCondition>
    : object) & {
    readonly hasItem?: TItemId
  }
}

type ShopProductsConstraint<
  TProducts,
  TItemId extends string,
  TWeaponId extends string,
  TArmorId extends string,
> = TProducts extends {
  readonly itemIds: infer TItemIds extends readonly unknown[]
  readonly weaponIds: infer TWeaponIds extends readonly unknown[]
  readonly armorIds: infer TArmorIds extends readonly unknown[]
}
  ? TProducts & {
      readonly itemIds: TItemIds & readonly TItemId[]
      readonly weaponIds: TWeaponIds & readonly TWeaponId[]
      readonly armorIds: TArmorIds & readonly TArmorId[]
    }
  : TProducts

type ShopDialogueConstraint<
  TDialogue,
  TItemId extends string,
  TWeaponId extends string,
  TArmorId extends string,
> = TDialogue & {
  readonly products: TDialogue extends { readonly products: infer TProducts }
    ? ShopProductsConstraint<TProducts, TItemId, TWeaponId, TArmorId>
    : {
        readonly itemIds: readonly TItemId[]
        readonly weaponIds: readonly TWeaponId[]
        readonly armorIds: readonly TArmorId[]
      }
} & (TDialogue extends {
    readonly topics: infer TTopics extends readonly unknown[]
  }
    ? {
        readonly topics: TTopics & readonly ShopTopicConstraint<ArrayEntry<TTopics>, TItemId>[]
      }
    : object)

type AbilityEntryConstraint<TEntry, TAbilityId extends string> = TEntry & {
  readonly abilityId: TAbilityId
}

/**
 * const input の ID union を参照側へ伝播する compile-time constraint。
 * JSON/unknown は runtime diagnostics、TS-first content はこの型と両方で守る。
 */
export type WorldContentReferenceConstraint<TInput extends WorldContentArraysInput> = {
  readonly items?: OptionalArray<TInput, "items">
  readonly weapons?: OptionalArray<TInput, "weapons">
  readonly armors?: OptionalArray<TInput, "armors">
  readonly recipes?: OptionalArray<TInput, "recipes"> &
    readonly RecipeConstraint<
      ArrayEntry<OptionalArray<TInput, "recipes">>,
      IdOf<OptionalArray<TInput, "items">>,
      IdOf<OptionalArray<TInput, "weapons">>,
      IdOf<OptionalArray<TInput, "armors">>,
      FacilityIdOf<TInput>
    >[]
  readonly monsters?: OptionalArray<TInput, "monsters"> &
    readonly MonsterConstraint<
      ArrayEntry<OptionalArray<TInput, "monsters">>,
      IdOf<OptionalArray<TInput, "items">>
    >[]
  readonly events?: OptionalArray<TInput, "events"> &
    readonly EventConstraint<
      ArrayEntry<OptionalArray<TInput, "events">>,
      IdOf<OptionalArray<TInput, "items">>
    >[]
  readonly areas?: OptionalArray<TInput, "areas"> &
    readonly AreaConstraint<
      ArrayEntry<OptionalArray<TInput, "areas">>,
      IdOf<OptionalArray<TInput, "items">>,
      IdOf<OptionalArray<TInput, "monsters">>,
      IdOf<OptionalArray<TInput, "events">>,
      IdOf<OptionalArray<TInput, "areas">>
    >[]
  readonly npcs?: OptionalArray<TInput, "npcs"> &
    readonly NpcConstraint<
      ArrayEntry<OptionalArray<TInput, "npcs">>,
      IdOf<OptionalArray<TInput, "items">>,
      IdOf<OptionalArray<TInput, "quests">>
    >[]
  readonly quests?: OptionalArray<TInput, "quests"> &
    readonly QuestConstraint<
      ArrayEntry<OptionalArray<TInput, "quests">>,
      IdOf<OptionalArray<TInput, "items">>,
      IdOf<OptionalArray<TInput, "weapons">>,
      IdOf<OptionalArray<TInput, "armors">>,
      IdOf<OptionalArray<TInput, "monsters">>,
      IdOf<OptionalArray<TInput, "areas">>,
      IdOf<OptionalArray<TInput, "npcs">>,
      IdOf<OptionalArray<TInput, "quests">>
    >[]
  readonly facilities?: OptionalArray<TInput, "facilities"> &
    readonly FacilityConstraint<
      ArrayEntry<OptionalArray<TInput, "facilities">>,
      IdOf<OptionalArray<TInput, "areas">>,
      IdOf<OptionalArray<TInput, "quests">>
    >[]
  readonly shopDialogues?: OptionalArray<TInput, "shopDialogues"> &
    readonly ShopDialogueConstraint<
      ArrayEntry<OptionalArray<TInput, "shopDialogues">>,
      IdOf<OptionalArray<TInput, "items">>,
      IdOf<OptionalArray<TInput, "weapons">>,
      IdOf<OptionalArray<TInput, "armors">>
    >[]
  readonly abilityTable?: OptionalArray<TInput, "abilityTable"> &
    readonly AbilityEntryConstraint<
      ArrayEntry<OptionalArray<TInput, "abilityTable">>,
      IdOf<OptionalArray<TInput, "abilities">>
    >[]
  readonly abilities?: OptionalArray<TInput, "abilities">
}

export type TypeSafeWorldContentInput<TInput extends WorldContentArraysInput> = TInput &
  WorldContentReferenceConstraint<TInput>

export type WorldContentReferenceCheck<TInput extends WorldContentArraysInput> =
  TInput extends WorldContentReferenceConstraint<TInput>
    ? readonly []
    : readonly [invalidWorldContentReference: never]
