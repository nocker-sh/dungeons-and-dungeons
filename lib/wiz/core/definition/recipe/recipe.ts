import { z } from "zod"
import { zWizContentRecipeMaterial } from "@/lib/wiz/core/definition/recipe/recipe-material"
import { zWizContentRecipeResult } from "@/lib/wiz/core/definition/recipe/recipe-result"

export const zWizContentRecipe = z
  .strictObject({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    materials: z.array(zWizContentRecipeMaterial),
    result: zWizContentRecipeResult,
    difficulty: z.number().finite().nonnegative(),
    requiresFacility: z.string().optional(),
  })
  .superRefine((recipe, context) => {
    const firstIndexByMaterial = new Map<string, number>()
    recipe.materials.forEach((material, index) => {
      const id =
        material.type === "item"
          ? material.itemId
          : material.type === "weapon"
            ? material.weaponId
            : material.armorId
      const key = `${material.type}:${id}`
      const firstIndex = firstIndexByMaterial.get(key)
      if (firstIndex === undefined) {
        firstIndexByMaterial.set(key, index)
        return
      }
      context.addIssue({
        code: "custom",
        path: ["materials", index, `${material.type}Id`],
        message: `duplicate recipe material; first declared at index ${firstIndex}`,
      })
    })
  })

export type WizContentRecipe = z.infer<typeof zWizContentRecipe>
