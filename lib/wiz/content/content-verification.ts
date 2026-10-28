import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { ContentVerification } from "./content-verification/context"
import { verifyInitialContent } from "@/lib/wiz/content/content-verification/verify-initial-content"
import { verifyInitialSupplies } from "@/lib/wiz/content/content-verification/verify-initial-supplies"
import { verifyConversations } from "./content-verification/conversations"
import { verifyMembers } from "@/lib/wiz/content/content-verification/verify-members"
import { verifyRecruiting } from "@/lib/wiz/content/content-verification/verify-recruiting"
import { verifySkills } from "@/lib/wiz/content/content-verification/verify-skills"
import { verifyEquipment } from "@/lib/wiz/content/content-verification/verify-equipment"
import { verifyDemons } from "./content-verification/demons"
import { verifyDiscoveries } from "@/lib/wiz/content/content-verification/verify-discoveries"
import { verifyFoes } from "@/lib/wiz/content/content-verification/verify-foes"
import { verifyLayers } from "@/lib/wiz/content/content-verification/verify-layers"
import { verifySmithy } from "@/lib/wiz/content/content-verification/verify-smithy"
import { verifyShops } from "@/lib/wiz/content/content-verification/verify-shops"
import { verifyQuests } from "@/lib/wiz/content/content-verification/verify-quests"

/** 形の検証後に参照を照合し、すべての誤りを決まった順で集める。 */
export function verifyContent(catalog: GameCatalog, problems: string[]) {
  const check: ContentVerification = {
    catalog,
    problems,
    need: (ok, message) => {
      if (!ok) problems.push(message)
    },
  }
  verifyInitialContent(check)
  verifyConversations(check)
  verifyMembers(check)
  verifySkills(check)
  verifyEquipment(check)
  verifyDemons(check)
  verifyInitialSupplies(check)
  verifyDiscoveries(check)
  verifyRecruiting(check)
  verifySmithy(check)
  verifyFoes(check)
  verifyLayers(check)
  verifyShops(check)
  verifyQuests(check)
}
