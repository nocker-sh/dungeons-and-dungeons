import { z } from "zod"
import type { WizItemEffectEvent } from "@/lib/wiz/core/domain/services/item-effect-service"
import type {
  WizBattleEffectReference,
  WizBattleEffectRemoval,
  WizLogMessage,
} from "@/lib/wiz/core/types/wiz-log-message"
import { WizVaultAreaStateSchema } from "@/lib/wiz/core/vault/states/area/schema"
import {
  WizStandardEquipmentStateSchema,
  WizStandardInventoryStateSchema,
} from "@/lib/wiz/core/vault/standard-inventory"
import { WizVaultNpcSchema } from "@/lib/wiz/core/vault/states/npc/schema"
import {
  WizVaultPartyMemberStateSchema,
  WizVaultPlayerStateSchema,
} from "@/lib/wiz/core/vault/states/player/schema"
import { WizVaultQuestStateSchema } from "@/lib/wiz/core/vault/states/quest/schema"
import {
  zWizVaultNonnegativeInteger,
  zWizVaultNonnegativeNumber,
  zWizVaultPositiveInteger,
  zWizVaultSemanticId,
} from "@/lib/wiz/core/vault/states/schema-values"
import { zWizVaultTimeState } from "@/lib/wiz/core/vault/states/time/schema"
import type { WizVaultObject } from "@/lib/wiz/core/vault/types"

const noPayload = <TKey extends string>(key: TKey) =>
  z.strictObject({
    key: z.literal(key),
  })

export const zWizItemEffectEvent: z.ZodType<WizItemEffectEvent> = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("hp_restored"), amount: zWizVaultNonnegativeNumber }),
  z.strictObject({ type: z.literal("mp_restored"), amount: zWizVaultNonnegativeNumber }),
  z.strictObject({ type: z.literal("hunger_restored"), amount: zWizVaultNonnegativeNumber }),
  z.strictObject({
    type: z.literal("temporary_stat_increased"),
    stat: zWizVaultSemanticId,
    amount: z.number().finite().positive(),
    duration: zWizVaultPositiveInteger,
  }),
  z.strictObject({ type: z.literal("revived"), hp: zWizVaultNonnegativeNumber }),
  z.strictObject({
    type: z.literal("status_cured"),
    effectId: zWizVaultSemanticId.optional(),
  }),
  z.strictObject({
    type: z.literal("teleport_requested"),
    targetId: zWizVaultSemanticId.optional(),
    destination: zWizVaultSemanticId.optional(),
  }),
  z.strictObject({ type: z.literal("light_activated") }),
  z.strictObject({
    type: z.literal("poison_requested"),
    potency: zWizVaultNonnegativeNumber.optional(),
  }),
  z.strictObject({
    type: z.literal("trap_requested"),
    power: zWizVaultNonnegativeNumber.optional(),
  }),
  z.strictObject({
    type: z.literal("fuel_requested"),
    amount: zWizVaultNonnegativeNumber.optional(),
  }),
  z.strictObject({
    type: z.literal("unlock_requested"),
    targetId: zWizVaultSemanticId.optional(),
  }),
])

export const zWizBattleEffectReference: z.ZodType<WizBattleEffectReference> = z.discriminatedUnion(
  "source",
  [
    z.strictObject({
      source: z.literal("system"),
      effectType: zWizVaultSemanticId,
    }),
    z.strictObject({
      source: z.literal("ability"),
      abilityId: zWizVaultSemanticId,
      effectType: zWizVaultSemanticId,
    }),
    z.strictObject({
      source: z.literal("item"),
      itemId: zWizVaultSemanticId,
      effectType: zWizVaultSemanticId,
    }),
  ],
)

export const zWizBattleEffectRemoval: z.ZodType<WizBattleEffectRemoval> = z.discriminatedUnion(
  "scope",
  [
    z.strictObject({ scope: z.literal("all") }),
    z.strictObject({
      scope: z.literal("effect"),
      effect: zWizBattleEffectReference,
    }),
  ],
)

/**
 * Save 入力ではログも key だけで通さず、key ごとの payload を検証する。
 */
export const zWizLogMessage: z.ZodType<WizLogMessage> = z.discriminatedUnion("key", [
  noPayload("WORLD_STARTED"),
  z.strictObject({ key: z.literal("SEASON_CHANGED"), season: zWizVaultSemanticId }),
  noPayload("HUNGER_DAMAGE"),
  z.strictObject({ key: z.literal("AREA_UNLOCKED"), areaId: zWizVaultSemanticId }),

  z.strictObject({
    key: z.literal("ITEM_EFFECT_APPLIED"),
    itemId: zWizVaultSemanticId,
    events: z.array(zWizItemEffectEvent),
  }),
  z.strictObject({ key: z.literal("EQUIPPED_WEAPON"), weaponId: zWizVaultSemanticId }),
  z.strictObject({ key: z.literal("EQUIPPED_ARMOR"), armorId: zWizVaultSemanticId }),
  noPayload("UNEQUIPPED_WEAPON"),
  noPayload("UNEQUIPPED_ARMOR"),

  z.strictObject({ key: z.literal("ENTERED_SHOP"), shopId: zWizVaultSemanticId }),
  noPayload("ENTERED_INN"),
  noPayload("NOT_ENOUGH_AP"),
  z.strictObject({ key: z.literal("ENTERED_AREA"), areaId: zWizVaultSemanticId }),
  z.strictObject({ key: z.literal("TALKED_TO_NPC"), npcId: zWizVaultSemanticId }),

  z.strictObject({
    key: z.literal("PURCHASED_ITEM"),
    itemId: zWizVaultSemanticId,
    price: zWizVaultNonnegativeNumber,
  }),
  z.strictObject({
    key: z.literal("PURCHASED_WEAPON"),
    weaponId: zWizVaultSemanticId,
    price: zWizVaultNonnegativeNumber,
  }),
  z.strictObject({
    key: z.literal("PURCHASED_ARMOR"),
    armorId: zWizVaultSemanticId,
    price: zWizVaultNonnegativeNumber,
  }),
  z.strictObject({
    key: z.literal("SOLD_ITEM"),
    itemId: zWizVaultSemanticId,
    price: zWizVaultNonnegativeNumber,
  }),
  noPayload("LEFT_SHOP"),
  z.strictObject({
    key: z.literal("HINT_DISCOVERED"),
    shopId: zWizVaultSemanticId,
    topicId: zWizVaultSemanticId,
  }),

  z.strictObject({ key: z.literal("INN_RESTED"), planId: zWizVaultSemanticId }),
  z.strictObject({
    key: z.literal("INN_NOT_ENOUGH_GOLD"),
    planId: zWizVaultSemanticId,
    required: zWizVaultNonnegativeNumber,
  }),
  noPayload("LEFT_INN"),

  noPayload("RETURNED_TO_VILLAGE"),
  z.strictObject({
    key: z.literal("DISCOVERED_MONSTER"),
    monsterId: zWizVaultSemanticId,
  }),
  z.strictObject({
    key: z.literal("ENCOUNTER_MONSTERS"),
    monsterIds: z.array(zWizVaultSemanticId),
  }),
  z.strictObject({ key: z.literal("GATHERED_ITEM"), itemId: zWizVaultSemanticId }),
  noPayload("EXPLORED_AREA"),
  z.strictObject({
    key: z.literal("EVENT_RESOLVED"),
    eventId: zWizVaultSemanticId,
    succeeded: z.boolean(),
  }),
  z.strictObject({ key: z.literal("RESTED"), apRecovered: zWizVaultNonnegativeNumber }),
  noPayload("NO_GATHERING_AVAILABLE"),
  noPayload("NO_MONSTERS_AVAILABLE"),
  z.strictObject({
    key: z.literal("FACILITY_UNLOCKED"),
    facilityId: zWizVaultSemanticId,
  }),

  noPayload("BATTLE_START"),
  z.strictObject({
    key: z.literal("BATTLE_VICTORY"),
    exp: zWizVaultNonnegativeNumber,
    gold: zWizVaultNonnegativeNumber,
  }),
  noPayload("BATTLE_DEFEAT"),
  z.strictObject({ key: z.literal("TURN_START"), turnNumber: zWizVaultPositiveInteger }),
  z.strictObject({
    key: z.literal("BATTLE_ATTACK"),
    actorId: zWizVaultSemanticId,
    targetId: zWizVaultSemanticId,
  }),
  z.strictObject({
    key: z.literal("BATTLE_ABILITY"),
    actorId: zWizVaultSemanticId,
    abilityId: zWizVaultSemanticId,
    targetId: zWizVaultSemanticId,
  }),
  z.strictObject({ key: z.literal("BATTLE_DEFEND"), actorId: zWizVaultSemanticId }),
  z.strictObject({
    key: z.literal("BATTLE_ITEM"),
    actorId: zWizVaultSemanticId,
    itemId: zWizVaultSemanticId,
    targetId: zWizVaultSemanticId,
  }),
  z.strictObject({ key: z.literal("BATTLE_FLEE"), actorId: zWizVaultSemanticId }),
  z.strictObject({
    key: z.literal("BATTLE_FLEE_SUCCESS"),
    actorId: zWizVaultSemanticId,
  }),
  z.strictObject({
    key: z.literal("BATTLE_FLEE_FAILED"),
    actorId: zWizVaultSemanticId,
  }),
  z.strictObject({
    key: z.literal("BATTLE_DAMAGE"),
    targetId: zWizVaultSemanticId,
    damage: zWizVaultNonnegativeNumber,
  }),
  z.strictObject({
    key: z.literal("BATTLE_HEAL"),
    targetId: zWizVaultSemanticId,
    amount: zWizVaultNonnegativeNumber,
  }),
  z.strictObject({
    key: z.literal("BATTLE_MISS"),
    actorId: zWizVaultSemanticId,
    targetId: zWizVaultSemanticId,
  }),
  z.strictObject({
    key: z.literal("BATTLE_CRITICAL"),
    actorId: zWizVaultSemanticId,
    targetId: zWizVaultSemanticId,
    damage: zWizVaultNonnegativeNumber,
  }),
  z.strictObject({
    key: z.literal("BATTLE_EFFECT_APPLIED"),
    targetId: zWizVaultSemanticId,
    effect: zWizBattleEffectReference,
  }),
  z.strictObject({
    key: z.literal("BATTLE_EFFECTS_REMOVED"),
    targetId: zWizVaultSemanticId,
    removal: zWizBattleEffectRemoval,
  }),
  z.strictObject({ key: z.literal("BATTLE_DEATH"), targetId: zWizVaultSemanticId }),
  noPayload("FLED_BATTLE"),
  noPayload("FLED_SUCCESS"),
  z.strictObject({
    key: z.literal("ACTOR_CANNOT_ACT"),
    actorId: zWizVaultSemanticId,
  }),

  z.strictObject({ key: z.literal("CRAFTED_ITEM"), recipeId: zWizVaultSemanticId }),
  noPayload("LEFT_CRAFTING"),

  z.strictObject({ key: z.literal("QUEST_COMPLETED"), questId: zWizVaultSemanticId }),
  z.strictObject({
    key: z.literal("QUEST_CHAIN_UNLOCKED"),
    questId: zWizVaultSemanticId,
  }),
  z.strictObject({
    key: z.literal("QUEST_REWARD_ITEM"),
    itemId: zWizVaultSemanticId,
    quantity: zWizVaultPositiveInteger,
  }),

  z.strictObject({
    key: z.literal("LEVEL_UP_POINTS_GRANTED"),
    points: zWizVaultNonnegativeInteger,
  }),
  z.strictObject({ key: z.literal("LEVEL_UP"), level: zWizVaultPositiveInteger }),
  z.strictObject({ key: z.literal("ABILITY_LEARNED"), abilityId: zWizVaultSemanticId }),

  z.strictObject({
    key: z.literal("AFFINITY_LEVEL_CHANGED"),
    npcId: zWizVaultSemanticId,
    level: zWizVaultSemanticId,
  }),
])

/**
 * 永続化境界で使う現行 Vault のルートスキーマ。
 *
 * 各 state schema を正本として組み合わせ、state 間の所有関係だけをここで検証する。
 */
export const zWizVault = z
  .strictObject({
    player: WizVaultPlayerStateSchema,
    partyMembers: z.array(WizVaultPartyMemberStateSchema),
    inventory: WizStandardInventoryStateSchema,
    equipment: WizStandardEquipmentStateSchema,
    time: zWizVaultTimeState,
    areas: z.array(WizVaultAreaStateSchema),
    npcs: z.array(WizVaultNpcSchema),
    quests: z.array(WizVaultQuestStateSchema),
    flags: z.array(zWizVaultSemanticId),
    log: z.array(zWizLogMessage),
    unlockedFacilities: z.array(zWizVaultSemanticId),
    isEnded: z.boolean(),
  })
  .superRefine((vault, context) => {
    const addDuplicateStringIssues = (
      values: readonly string[],
      path: "flags" | "unlockedFacilities",
    ): void => {
      const firstIndexByValue = new Map<string, number>()
      values.forEach((value, index) => {
        const firstIndex = firstIndexByValue.get(value)
        if (firstIndex === undefined) {
          firstIndexByValue.set(value, index)
          return
        }
        context.addIssue({
          code: "custom",
          path: [path, index],
          message: `duplicate ${path} value; first declared at index ${firstIndex}`,
        })
      })
    }
    const addDuplicateEntityIdIssues = (
      values: readonly { readonly id: string }[],
      path: "areas" | "npcs" | "quests",
    ): void => {
      const firstIndexById = new Map<string, number>()
      values.forEach((value, index) => {
        const firstIndex = firstIndexById.get(value.id)
        if (firstIndex === undefined) {
          firstIndexById.set(value.id, index)
          return
        }
        context.addIssue({
          code: "custom",
          path: [path, index, "id"],
          message: `duplicate ${path} ID; first declared at index ${firstIndex}`,
        })
      })
    }
    const addDuplicateNestedStringIssues = (
      values: readonly string[],
      path: readonly (string | number)[],
      label: string,
      valuePathSuffix?: string,
    ): void => {
      const firstIndexByValue = new Map<string, number>()
      values.forEach((value, index) => {
        const firstIndex = firstIndexByValue.get(value)
        if (firstIndex === undefined) {
          firstIndexByValue.set(value, index)
          return
        }
        context.addIssue({
          code: "custom",
          path: [...path, index, ...(valuePathSuffix === undefined ? [] : [valuePathSuffix])],
          message: `duplicate ${label}; first declared at index ${firstIndex}`,
        })
      })
    }

    Object.entries(vault.equipment).forEach(([slotId, entryId]) => {
      if (entryId === null) return
      if (vault.inventory.entries.some((entry) => entry.entryId === entryId)) return
      context.addIssue({
        code: "custom",
        path: ["equipment", slotId],
        message: `equipment slot ${slotId} must reference an owned inventory entry`,
      })
    })

    const firstPartyMemberIndexById = new Map<string, number>()
    vault.partyMembers.forEach((member, index) => {
      const firstIndex = firstPartyMemberIndexById.get(member.id)
      if (firstIndex === undefined) {
        firstPartyMemberIndexById.set(member.id, index)
        return
      }
      context.addIssue({
        code: "custom",
        path: ["partyMembers", index, "id"],
        message: `duplicate party member ID; first declared at index ${firstIndex}`,
      })
    })

    addDuplicateStringIssues(vault.flags, "flags")
    addDuplicateStringIssues(vault.unlockedFacilities, "unlockedFacilities")
    addDuplicateEntityIdIssues(vault.areas, "areas")
    addDuplicateEntityIdIssues(vault.npcs, "npcs")
    addDuplicateEntityIdIssues(vault.quests, "quests")
    addDuplicateNestedStringIssues(
      vault.player.abilityIds,
      ["player", "abilityIds"],
      "player ability ID",
    )
    vault.partyMembers.forEach((member, index) => {
      addDuplicateNestedStringIssues(
        member.abilityIds,
        ["partyMembers", index, "abilityIds"],
        "party member ability ID",
      )
    })
  }) satisfies z.ZodType<WizVaultObject>

export type WizVaultSchema = z.infer<typeof zWizVault>

export const parseWizVaultObject = (input: unknown): WizVaultObject => zWizVault.parse(input)
