import { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { wizMockHealer, wizMockHero, wizMockMage } from "@/lib/wiz/core/mocks/mock-character"

export const wizMockSoloParty = () =>
  new WizBattleParty({
    id: "party-1",
    members: [wizMockHero()],
  })

export const wizMockDuoParty = () =>
  new WizBattleParty({
    id: "party-1",
    members: [wizMockHero(), wizMockMage()],
  })

export const wizMockFullParty = () =>
  new WizBattleParty({
    id: "party-1",
    members: [wizMockHero(), wizMockMage(), wizMockHealer()],
  })
