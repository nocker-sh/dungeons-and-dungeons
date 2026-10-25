import { WizPartyMemberGrowthTable } from "@/lib/wiz/core/engine/level-up/party-level-up"

export const createWizStandardPartyMemberGrowthTable = (): WizPartyMemberGrowthTable =>
  new WizPartyMemberGrowthTable({
    classes: {
      warrior: {
        hp: 8,
        mp: 1,
        attributes: {
          strength: 2,
          dexterity: 1,
          agility: 1,
          vitality: 2,
        },
      },
      mage: {
        hp: 3,
        mp: 5,
        attributes: {
          dexterity: 1,
          agility: 1,
          vitality: 1,
          wisdom: 3,
          charisma: 1,
        },
      },
      healer: {
        hp: 4,
        mp: 4,
        attributes: {
          dexterity: 1,
          agility: 1,
          vitality: 1,
          wisdom: 2,
          charisma: 2,
        },
      },
      thief: {
        hp: 5,
        mp: 2,
        attributes: {
          strength: 1,
          dexterity: 3,
          agility: 2,
          vitality: 1,
          charisma: 1,
        },
      },
    },
  })
