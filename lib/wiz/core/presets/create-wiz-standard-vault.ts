import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizVaultFactory } from "@/lib/wiz/core/vault/factory/factory"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

/**
 * vault runtimeとcanonical contentを接続するstandard専用adapter。
 *
 * @internal
 */
export const createWizStandardVault = <TArrays extends WorldContentArrays>(
  content: WorldContent<TArrays>
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
  const abilityIds = new Set(
    content.arrays.abilities.map((ability) => ability.id)
  )
  return vault
    .updatePlayer((player) =>
      player.withAbilityIds(
        player.abilityIds.filter((abilityId) => abilityIds.has(abilityId))
      )
    )
    .withPartyMembers(
      vault.partyMembers.map((member) => ({
        ...member,
        abilityIds: member.abilityIds.filter((abilityId) =>
          abilityIds.has(abilityId)
        ),
      }))
    )
}
