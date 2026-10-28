import type { WizContentRecipeMaterial } from "@/lib/wiz/core/definition/recipe/recipe-material"

export const getWizContentRecipeMaterialId = (
  material: WizContentRecipeMaterial
): string => {
  if (material.type === "weapon") return material.weaponId
  if (material.type === "armor") return material.armorId
  return material.itemId
}
