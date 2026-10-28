import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"

/** @internal */
export const createWizStandardShopDialogueService = <
  TArrays extends WorldContentArrays,
>(
  content: WorldContent<TArrays>
): WizEngineShopDialogueService =>
  new WizEngineShopDialogueService(content.shopDialogues)
