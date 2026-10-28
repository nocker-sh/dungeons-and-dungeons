import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizEngineAbilityLearning } from "@/lib/wiz/core/engine/ability/wiz-engine-ability-learning"

/** @internal */
export const createWizStandardAbilityLearning = <
  TArrays extends WorldContentArrays,
>(
  content: WorldContent<TArrays>
): WizEngineAbilityLearning =>
  new WizEngineAbilityLearning(content.abilityTable)
