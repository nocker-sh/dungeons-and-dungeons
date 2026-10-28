import type { GameContent } from "@/lib/wiz/content/content-schema"
import { finder } from "@/lib/wiz/testing/finder"
import { content } from "@/lib/wiz/testing/real-content"

export type RealRecipe = NonNullable<GameContent["smithy"]>["recipes"][number]

/** 鍛冶屋の生産のレシピ。 */
export const recipeBySlug = finder<RealRecipe>(
  "recipe",
  content.smithy?.recipes ?? []
)
