import { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { wizMockHero } from "@/lib/wiz/core/mocks/wiz-mock-hero"
import { wizMockMage } from "@/lib/wiz/core/mocks/wiz-mock-mage"

export const wizMockDuoParty = () =>
  new WizBattleParty({
    id: "party-1",
    members: [wizMockHero(), wizMockMage()],
  })
