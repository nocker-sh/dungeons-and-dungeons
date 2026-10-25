import { describe, expect, it } from "vite-plus/test"
import {
  WIZ_STANDARD_DEFAULT_EQUIPMENT,
  WIZ_STANDARD_DEFAULT_INVENTORY,
} from "@/lib/wiz/core/vault/standard-inventory"
import type {
  WizStandardEquipmentState,
  WizStandardInventoryState,
} from "@/lib/wiz/core/vault/types"
import {
  WIZ_VAULT_DEFAULT_GIFT_BONUSES,
  type WizVaultGiftBonuses,
} from "@/lib/wiz/core/vault/states/npc/type"
import {
  WIZ_VAULT_DEFAULT_ATTRIBUTES,
  WIZ_VAULT_DEFAULT_PARTY_MEMBERS,
  WIZ_VAULT_DEFAULT_PLAYER,
  type WizVaultPartyMemberState,
  type WizVaultPlayerState,
} from "@/lib/wiz/core/vault/states/player/schema"

describe("vault shared defaults", () => {
  it("playerとparty memberを全階層でfreezeする", () => {
    expect(Object.isFrozen(WIZ_VAULT_DEFAULT_ATTRIBUTES)).toBe(true)
    expect(Object.isFrozen(WIZ_VAULT_DEFAULT_PLAYER)).toBe(true)
    expect(Object.isFrozen(WIZ_VAULT_DEFAULT_PLAYER.attributes)).toBe(true)
    expect(Object.isFrozen(WIZ_VAULT_DEFAULT_PLAYER.abilityIds)).toBe(true)
    expect(Object.isFrozen(WIZ_VAULT_DEFAULT_PARTY_MEMBERS)).toBe(true)

    for (const partyMember of WIZ_VAULT_DEFAULT_PARTY_MEMBERS) {
      expect(Object.isFrozen(partyMember)).toBe(true)
      expect(Object.isFrozen(partyMember.attributes)).toBe(true)
      expect(Object.isFrozen(partyMember.abilityIds)).toBe(true)
    }
  })

  it("inventoryとgift bonusを全階層でfreezeする", () => {
    expect(Object.isFrozen(WIZ_STANDARD_DEFAULT_EQUIPMENT)).toBe(true)
    expect(Object.isFrozen(WIZ_STANDARD_DEFAULT_INVENTORY)).toBe(true)
    expect(Object.isFrozen(WIZ_STANDARD_DEFAULT_INVENTORY.entries)).toBe(true)
    expect(Object.isFrozen(WIZ_VAULT_DEFAULT_GIFT_BONUSES)).toBe(true)
  })

  it("schemaから公開するstate型もnested valueをreadonlyにする", () => {
    const verifyReadonlyStateTypes = (
      player: WizVaultPlayerState,
      partyMember: WizVaultPartyMemberState,
      inventory: WizStandardInventoryState,
      equipment: WizStandardEquipmentState,
      giftBonuses: WizVaultGiftBonuses,
    ): void => {
      // @ts-expect-error player ability IDs are deeply readonly.
      player.abilityIds.push("forged")
      // @ts-expect-error player attributes are deeply readonly.
      player.attributes.strength = 999
      // @ts-expect-error party member ability IDs are deeply readonly.
      partyMember.abilityIds.push("forged")
      // @ts-expect-error inventory item slots are deeply readonly.
      inventory.entries[0]!.quantity = 999
      // @ts-expect-error equipment slots are readonly.
      equipment.mainHand = "forged"
      // @ts-expect-error gift bonus values are readonly.
      giftBonuses.like = 999
    }

    expect(verifyReadonlyStateTypes).toBeTypeOf("function")
  })
})
