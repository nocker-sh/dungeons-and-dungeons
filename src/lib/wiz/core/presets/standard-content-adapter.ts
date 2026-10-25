import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizEngineBattleContent } from "@/lib/wiz/core/engine/battle/content"
import { isBattleUsableItemDefinition } from "@/lib/wiz/core/engine/battle/item"
import { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import { WizEngineAbilityLearning } from "@/lib/wiz/core/engine/ability/wiz-engine-ability-learning"
import { WizVaultFactory } from "@/lib/wiz/core/vault/factory/factory"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

/**
 * vault runtimeとcanonical contentを接続するstandard専用adapter。
 *
 * @internal
 */
export const createWizStandardVault = <TArrays extends WorldContentArrays>(
  content: WorldContent<TArrays>,
): WizVaultValue => {
  const vault = new WizVaultFactory({
    monsters: content.arrays.monsters,
    events: content.arrays.events,
    areas: content.arrays.areas,
    npcs: content.arrays.npcs,
    quests: content.arrays.quests,
    equipmentSlotIds: [
      ...new Set([
        ...content.arrays.weapons.map((weapon) => weapon.slotId),
        ...content.arrays.armors.map((armor) => armor.slotId),
      ]),
    ],
  }).createInitialVault()
  const abilityIds = new Set(content.arrays.abilities.map((ability) => ability.id))
  return vault
    .updatePlayer((player) =>
      player.withAbilityIds(player.abilityIds.filter((abilityId) => abilityIds.has(abilityId))),
    )
    .withPartyMembers(
      vault.partyMembers.map((member) => ({
        ...member,
        abilityIds: member.abilityIds.filter((abilityId) => abilityIds.has(abilityId)),
      })),
    )
}

/** @internal */
export const createWizStandardBattleContent = <TArrays extends WorldContentArrays>(
  content: WorldContent<TArrays>,
): WizEngineBattleContent =>
  new WizEngineBattleContent({
    abilities: content.abilities,
    items: Object.fromEntries(
      content.arrays.items.flatMap((item) =>
        isBattleUsableItemDefinition(item) ? [[item.id, item] as const] : [],
      ),
    ),
  })

/** @internal */
export const createWizStandardShopDialogueService = <TArrays extends WorldContentArrays>(
  content: WorldContent<TArrays>,
): WizEngineShopDialogueService => new WizEngineShopDialogueService(content.shopDialogues)

/** @internal */
export const createWizStandardAbilityLearning = <TArrays extends WorldContentArrays>(
  content: WorldContent<TArrays>,
): WizEngineAbilityLearning => new WizEngineAbilityLearning(content.abilityTable)
