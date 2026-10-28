import type { WizContentRecipeMaterial } from "@/lib/wiz/core/definition/recipe/recipe-material"

export type WizContentRecipeMaterialType = "item" | "weapon" | "armor"

export const getWizContentRecipeMaterialType = (
  material: WizContentRecipeMaterial
): WizContentRecipeMaterialType => {
  return material.type
}
