import type { Preview, PreviewOptions } from "@/development/scenarios/types"
import { createPreviewContext } from "@/development/scenarios/context"
import { createCombatScenarios } from "@/development/scenarios/combat"
import { createArmorScenarios } from "@/development/scenarios/armor"
import { createEquipmentScenarios } from "@/development/scenarios/equipment"
import { createExplorationScenarios } from "@/development/scenarios/exploration"
import { townPreviews } from "@/development/scenarios/town-previews"
import { routeEntryPreviews } from "@/development/scenarios/route-entry-previews"
import { dungeonPreviews } from "@/development/scenarios/dungeon-previews"
import { shopPreviews } from "@/development/scenarios/shop-previews"
import { smithyPreviews } from "@/development/scenarios/smithy-previews"
import { outfitPreviews } from "@/development/scenarios/outfit-previews"
import { resultPreviews } from "@/development/scenarios/result-previews"
/** 本物のゲーム規則で作る場面の一覧。状態の準備と登録を分離する。 */
export function previews(options: PreviewOptions = {}): Preview[] {
  const context = createPreviewContext(options)
  const combat = createCombatScenarios(context)
  const armor = createArmorScenarios(context)
  const equipment = createEquipmentScenarios(context)
  const exploration = createExplorationScenarios(context, combat)
  return [
    ...townPreviews(context, equipment),
    ...routeEntryPreviews(context, exploration),
    ...shopPreviews(context, equipment),
    ...outfitPreviews(context),
    ...dungeonPreviews(context, combat, armor, exploration),
    ...smithyPreviews(context, armor, equipment),
    ...resultPreviews(context, exploration),
  ]
}
