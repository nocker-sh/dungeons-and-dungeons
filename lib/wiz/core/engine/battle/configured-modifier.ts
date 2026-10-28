import type { WizBattleAttributeModifier } from "@/lib/wiz/core/engine/battle/effects"
import { readModifier } from "@/lib/wiz/core/engine/battle/read-modifier"
import { readOwnDataProperty } from "@/lib/wiz/core/engine/battle/read-own-data-property"

export const configuredModifier = (
  custom: unknown
): WizBattleAttributeModifier | undefined =>
  readModifier(readOwnDataProperty(custom, "statusModifier"))
