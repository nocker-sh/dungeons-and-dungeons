import type { WizBattleAttributeModifier } from "@/lib/wiz/core/engine/battle/effects"
import { getFiniteNumber } from "@/lib/wiz/core/engine/battle/get-finite-number"
import { readOwnDataProperty } from "@/lib/wiz/core/engine/battle/read-own-data-property"

export const readModifier = (
  value: unknown
): WizBattleAttributeModifier | undefined => {
  if (typeof value !== "object" || value === null) return undefined
  const attack = getFiniteNumber(readOwnDataProperty(value, "attack"))
  const defense = getFiniteNumber(readOwnDataProperty(value, "defense"))
  const speed = getFiniteNumber(readOwnDataProperty(value, "speed"))
  if (attack === undefined && defense === undefined && speed === undefined)
    return undefined
  return Object.freeze({ attack, defense, speed })
}
