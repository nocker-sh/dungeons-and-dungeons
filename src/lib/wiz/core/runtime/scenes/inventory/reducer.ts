import type { WizItemEffectApplicationService } from "@/lib/wiz/core/domain/services/item-effect-service"
import { WizVaultPlayerItemEffectService } from "@/lib/wiz/core/engine/inventory/wiz-vault-item-effect-service"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import {
  WizRpgEquipmentRules,
  type WizRpgStandardEquipmentRuleReason,
} from "@/lib/wiz/core/rpg/equipment-rules"
import {
  getWizRuntimeContentEntry,
  type WizRuntimeContentView,
} from "@/lib/wiz/core/runtime/content-view"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneInventoryAction } from "@/lib/wiz/core/runtime/scenes/inventory/action"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import type { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"
import type { WizStandardInventoryEntryState } from "@/lib/wiz/core/vault/types"
import type { WizInventoryEntry } from "@/lib/wiz/core/domain/values/inventory"

type StandardInventoryEntry = WizInventoryEntry<
  WizStandardInventoryEntryState["entryId"],
  WizStandardInventoryEntryState["contentType"],
  WizStandardInventoryEntryState["contentId"],
  WizStandardInventoryEntryState["custom"]
>

type Properties = {
  readonly content: Pick<WizRuntimeContentView, "items" | "weapons" | "armors">
  readonly itemEffect?: WizItemEffectApplicationService<WizVaultPlayer>
  readonly equipmentRules?: WizRpgEquipmentRules<StandardInventoryEntry, string>
}

export type WizSceneInventoryRejectionReason =
  | WizRpgStandardEquipmentRuleReason
  | "INVENTORY_EQUIPMENT_NOT_FOUND"
  | "INVENTORY_EQUIPMENT_SLOT_EMPTY"
  | "INVENTORY_ITEM_DEFINITION_NOT_FOUND"
  | "INVENTORY_ITEM_EFFECT_REJECTED"
  | "INVENTORY_ITEM_NOT_FOUND"

export class WizSceneInventoryReducer<TEquipmentReason extends string = never> {
  private readonly content: Pick<WizRuntimeContentView, "items" | "weapons" | "armors">
  private readonly itemEffect: WizItemEffectApplicationService<WizVaultPlayer>
  private readonly equipmentRules: WizRpgEquipmentRules<
    StandardInventoryEntry,
    TEquipmentReason | WizRpgStandardEquipmentRuleReason
  >

  constructor(
    properties: Omit<Properties, "equipmentRules"> &
      Readonly<{
        equipmentRules?: WizRpgEquipmentRules<StandardInventoryEntry, TEquipmentReason>
      }>,
  ) {
    this.content = properties.content
    this.itemEffect = properties.itemEffect ?? new WizVaultPlayerItemEffectService()
    this.equipmentRules =
      properties.equipmentRules ??
      (WizRpgEquipmentRules.standard() as WizRpgEquipmentRules<
        StandardInventoryEntry,
        TEquipmentReason | WizRpgStandardEquipmentRuleReason
      >)
    Object.freeze(this)
  }

  reduce(
    state: WizState,
    action: WizAction | WizSceneInventoryAction,
  ): WizSceneResult<WizState, never, WizSceneInventoryRejectionReason | TEquipmentReason> {
    if (action.type === "USE_ITEM") {
      return this.handleUseItem(state, action)
    }

    if (action.type === "EQUIP") {
      const entry = state.vault.inventory.find(action.entryId)
      if (
        entry === undefined ||
        (entry.contentType !== "weapon" && entry.contentType !== "armor")
      ) {
        return WizSceneResultFactory.reject(state, "INVENTORY_EQUIPMENT_NOT_FOUND")
      }
      const itemDefinition =
        entry.contentType === "weapon"
          ? getWizRuntimeContentEntry(this.content.weapons, entry.contentId)
          : getWizRuntimeContentEntry(this.content.armors, entry.contentId)
      if (!itemDefinition) {
        return WizSceneResultFactory.reject(state, "INVENTORY_EQUIPMENT_NOT_FOUND")
      }
      const resolution = this.equipmentRules.equip({
        definition: itemDefinition,
        entry,
        equipment: state.vault.equipment,
        inventory: state.vault.inventory,
        slotId: action.slotId,
      })
      if (!resolution.accepted) {
        return WizSceneResultFactory.reject(state, resolution.reason)
      }
      return WizSceneResultFactory.accept(
        state.updateVault((vault) => {
          const equippedVault = vault.withEquipment(resolution.equipment)
          return entry.contentType === "weapon"
            ? equippedVault.addLog({
                key: "EQUIPPED_WEAPON",
                weaponId: entry.contentId,
              })
            : equippedVault.addLog({
                key: "EQUIPPED_ARMOR",
                armorId: entry.contentId,
              })
        }),
      )
    }

    if (action.type === "UNEQUIP") {
      const equippedEntryId = state.vault.equippedAt(action.slotId)
      if (equippedEntryId === null) {
        return WizSceneResultFactory.reject(state, "INVENTORY_EQUIPMENT_SLOT_EMPTY")
      }
      const equippedEntry = state.vault.inventory.find(equippedEntryId)
      if (equippedEntry === undefined) {
        return WizSceneResultFactory.reject(state, "INVENTORY_EQUIPMENT_NOT_FOUND")
      }
      const resolution = this.equipmentRules.unequip({
        equipment: state.vault.equipment,
        inventory: state.vault.inventory,
        slotId: action.slotId,
      })
      if (!resolution.accepted) {
        return WizSceneResultFactory.reject(state, resolution.reason)
      }
      return WizSceneResultFactory.accept(
        state.updateVault((vault) =>
          equippedEntry.contentType === "weapon"
            ? vault.withEquipment(resolution.equipment).addLog({ key: "UNEQUIPPED_WEAPON" })
            : vault.withEquipment(resolution.equipment).addLog({ key: "UNEQUIPPED_ARMOR" }),
        ),
      )
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleUseItem(
    state: WizState,
    action: { itemId: string },
  ): WizSceneResult<WizState, never, WizSceneInventoryRejectionReason> {
    const itemEntry = state.vault.inventory.entriesFor("item", action.itemId)[0]
    if (!itemEntry) {
      return WizSceneResultFactory.reject(state, "INVENTORY_ITEM_NOT_FOUND")
    }

    const itemDef = getWizRuntimeContentEntry(this.content.items, action.itemId)
    if (!itemDef) {
      return WizSceneResultFactory.reject(state, "INVENTORY_ITEM_DEFINITION_NOT_FOUND")
    }

    const result = this.itemEffect.apply(state.vault.player, itemDef.effect)
    if (!result.applied) {
      return WizSceneResultFactory.reject(state, "INVENTORY_ITEM_EFFECT_REJECTED")
    }

    return WizSceneResultFactory.accept(
      state.updateVault((vault) => {
        return vault
          .withPlayer(result.target)
          .updateInventory((inventory) => inventory.consume(itemEntry.entryId))
          .addLog({
            key: "ITEM_EFFECT_APPLIED",
            itemId: action.itemId,
            events: result.events,
          })
      }),
    )
  }
}
