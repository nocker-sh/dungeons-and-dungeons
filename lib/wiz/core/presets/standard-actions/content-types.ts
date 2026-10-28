import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WizBattleItemEffect } from "@/lib/wiz/core/engine/battle/item"

export type WizStandardCheckedId<
  TCandidate extends string,
  TAllowed extends string,
> = string extends TCandidate
  ? TAllowed
  : TCandidate extends TAllowed
    ? TCandidate
    : never

export type WizStandardCheckedIdInput<
  TCandidate extends string,
  TAllowed extends string,
> = TCandidate extends TAllowed
  ? TCandidate
  : string extends TCandidate
    ? TCandidate
    : never

export type WizStandardCheckedIndex<
  TCandidate extends number,
  TAllowed extends number,
> = number extends TCandidate
  ? TAllowed
  : TCandidate extends TAllowed
    ? TCandidate
    : never

export type WizStandardCheckedIndexInput<
  TCandidate extends number,
  TAllowed extends number,
> = TCandidate extends TAllowed
  ? TCandidate
  : number extends TCandidate
    ? TCandidate
    : never

export type WizStandardContentEntry<
  TArrays extends WorldContentArrays,
  TKey extends keyof TArrays,
> = TArrays[TKey] extends readonly (infer TEntry)[] ? TEntry : never

export type WizStandardContentId<
  TArrays extends WorldContentArrays,
  TKey extends keyof TArrays,
> =
  WizStandardContentEntry<TArrays, TKey> extends {
    readonly id: infer TId extends string
  }
    ? TId
    : never

type EntryForId<
  TArrays extends WorldContentArrays,
  TKey extends keyof TArrays,
  TId extends string,
> =
  WizStandardContentEntry<TArrays, TKey> extends infer TEntry
    ? TEntry extends { readonly id: infer TEntryId extends string }
      ? TId extends TEntryId
        ? TEntry
        : never
      : never
    : never

export type WizStandardFoodItemId<TArrays extends WorldContentArrays> =
  string extends WizStandardContentId<TArrays, "items">
    ? WizStandardContentId<TArrays, "items">
    : WizStandardContentEntry<TArrays, "items"> extends infer TItem
      ? TItem extends {
          readonly id: infer TId extends string
          readonly effect: { readonly type: "food" }
        }
        ? TId
        : never
      : never

export type WizStandardBattleItemId<TArrays extends WorldContentArrays> =
  string extends WizStandardContentId<TArrays, "items">
    ? WizStandardContentId<TArrays, "items">
    : WizStandardContentEntry<TArrays, "items"> extends infer TItem
      ? TItem extends {
          readonly id: infer TId extends string
          readonly effect: { readonly type: WizBattleItemEffect["type"] }
        }
        ? TId
        : never
      : never

export type WizStandardAreaId<TArrays extends WorldContentArrays> =
  WizStandardContentId<TArrays, "areas">

export type WizStandardAreaMonsterId<
  TArrays extends WorldContentArrays,
  TAreaId extends WizStandardAreaId<TArrays>,
> =
  EntryForId<TArrays, "areas", TAreaId> extends {
    readonly monsterIds: readonly (infer TMonsterId extends string)[]
  }
    ? TMonsterId
    : never

export type WizStandardEventId<TArrays extends WorldContentArrays> =
  WizStandardContentId<TArrays, "events">

type EventChoices<
  TArrays extends WorldContentArrays,
  TEventId extends WizStandardEventId<TArrays>,
> =
  EntryForId<TArrays, "events", TEventId> extends {
    readonly choices: infer TChoices extends readonly unknown[]
  }
    ? TChoices
    : readonly unknown[]

type TupleIndex<TValues extends readonly unknown[]> =
  number extends TValues["length"]
    ? number
    : Exclude<keyof TValues, keyof (readonly unknown[])> extends infer TIndex
      ? TIndex extends `${infer TNumber extends number}`
        ? TNumber
        : never
      : never

export type WizStandardEventChoiceIndex<
  TArrays extends WorldContentArrays,
  TEventId extends WizStandardEventId<TArrays>,
> = TupleIndex<EventChoices<TArrays, TEventId>>

export type WizStandardNpcId<TArrays extends WorldContentArrays> =
  WizStandardContentId<TArrays, "npcs">

type NpcDialogues<
  TArrays extends WorldContentArrays,
  TNpcId extends WizStandardNpcId<TArrays>,
> =
  EntryForId<TArrays, "npcs", TNpcId> extends {
    readonly dialogues: infer TDialogues extends readonly unknown[]
  }
    ? TDialogues
    : readonly unknown[]

export type WizStandardDialogueId<
  TArrays extends WorldContentArrays,
  TNpcId extends WizStandardNpcId<TArrays>,
> = NpcDialogues<TArrays, TNpcId>[number] extends infer TDialogue
  ? TDialogue extends { readonly id: infer TDialogueId extends string }
    ? TDialogueId
    : never
  : never

type DialogueForId<
  TArrays extends WorldContentArrays,
  TNpcId extends WizStandardNpcId<TArrays>,
  TDialogueId extends WizStandardDialogueId<TArrays, TNpcId>,
> = NpcDialogues<TArrays, TNpcId>[number] extends infer TDialogue
  ? TDialogue extends { readonly id: infer TEntryId extends string }
    ? TDialogueId extends TEntryId
      ? TDialogue
      : never
    : never
  : never

export type WizStandardDialogueOptionId<
  TArrays extends WorldContentArrays,
  TNpcId extends WizStandardNpcId<TArrays>,
  TDialogueId extends WizStandardDialogueId<TArrays, TNpcId>,
> =
  DialogueForId<TArrays, TNpcId, TDialogueId> extends infer TDialogue
    ? TDialogue extends {
        readonly options?: infer TOptions
      }
      ? NonNullable<TOptions> extends readonly (infer TOption)[]
        ? TOption extends { readonly id: infer TOptionId extends string }
          ? TOptionId
          : never
        : never
      : never
    : never

export type WizStandardRecipeId<TArrays extends WorldContentArrays> =
  WizStandardContentId<TArrays, "recipes">

export type WizStandardInnPlanId<TArrays extends WorldContentArrays> =
  WizStandardContentId<TArrays, "innPlans">

export type WizStandardQuestId<TArrays extends WorldContentArrays> =
  WizStandardContentId<TArrays, "quests">

export type WizStandardEquipmentSlotId<TArrays extends WorldContentArrays> =
  | (WizStandardContentEntry<TArrays, "weapons"> extends {
      readonly slotId: infer TSlotId extends string
    }
      ? TSlotId
      : never)
  | (WizStandardContentEntry<TArrays, "armors"> extends {
      readonly slotId: infer TSlotId extends string
    }
      ? TSlotId
      : never)

type ShopIdOf<TEntry> = TEntry extends {
  readonly shopId: infer TId extends string
}
  ? TId
  : never

export type WizStandardShopId<TArrays extends WorldContentArrays> = ShopIdOf<
  WizStandardContentEntry<TArrays, "shopDialogues">
>

type ShopEntryForId<
  TArrays extends WorldContentArrays,
  TShopId extends WizStandardShopId<TArrays>,
> =
  WizStandardContentEntry<TArrays, "shopDialogues"> extends infer TEntry
    ? TEntry extends { readonly shopId: infer TEntryId extends string }
      ? TShopId extends TEntryId
        ? TEntry
        : never
      : never
    : never

type ShopProductIdOfEntry<
  TEntry,
  TKey extends "armorIds" | "itemIds" | "weaponIds",
> = TEntry extends {
  readonly products: Record<TKey, readonly (infer TId extends string)[]>
}
  ? TId
  : never

type ShopTopicIdOfEntry<TEntry> = TEntry extends {
  readonly topics: readonly (infer TTopic)[]
}
  ? TTopic extends { readonly id: infer TId extends string }
    ? TId
    : never
  : never

export type WizStandardShopItemId<
  TArrays extends WorldContentArrays,
  TShopId extends WizStandardShopId<TArrays>,
> = ShopProductIdOfEntry<ShopEntryForId<TArrays, TShopId>, "itemIds">

export type WizStandardShopWeaponId<
  TArrays extends WorldContentArrays,
  TShopId extends WizStandardShopId<TArrays>,
> = ShopProductIdOfEntry<ShopEntryForId<TArrays, TShopId>, "weaponIds">

export type WizStandardShopArmorId<
  TArrays extends WorldContentArrays,
  TShopId extends WizStandardShopId<TArrays>,
> = ShopProductIdOfEntry<ShopEntryForId<TArrays, TShopId>, "armorIds">

export type WizStandardShopTopicId<
  TArrays extends WorldContentArrays,
  TShopId extends WizStandardShopId<TArrays>,
> = ShopTopicIdOfEntry<ShopEntryForId<TArrays, TShopId>>
