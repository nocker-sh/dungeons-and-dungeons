import type { Preview, PreviewOptions } from "./types"
export type { Preview } from "./types"
import { createPreviewContext } from "./context"
import { createCombatScenarios } from "./combat"
import { createArmorScenarios } from "./armor"
import { createEquipmentScenarios } from "./equipment"
import { createExplorationScenarios } from "./exploration"
import { townPreviews } from "./town-previews"
import { routeEntryPreviews, dungeonPreviews } from "./dungeon-previews"
import { shopPreviews, smithyPreviews } from "./shop-previews"
import { outfitPreviews } from "./outfit-previews"
import { resultPreviews } from "./result-previews"
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
