import { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { wizMockHero } from "@/lib/wiz/core/mocks/wiz-mock-hero"

export const wizMockSoloParty = () =>
  new WizBattleParty({
    id: "party-1",
    members: [wizMockHero()],
  })
