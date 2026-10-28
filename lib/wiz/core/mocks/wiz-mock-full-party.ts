import { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { wizMockHealer } from "@/lib/wiz/core/mocks/wiz-mock-healer"
import { wizMockHero } from "@/lib/wiz/core/mocks/wiz-mock-hero"
import { wizMockMage } from "@/lib/wiz/core/mocks/wiz-mock-mage"

export const wizMockFullParty = () =>
  new WizBattleParty({
    id: "party-1",
    members: [wizMockHero(), wizMockMage(), wizMockHealer()],
  })
