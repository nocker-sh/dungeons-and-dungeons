import { byId } from "@/lib/wiz/content/by-id"
import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifySmithy({ catalog, need, problems }: ContentVerification) {
  const data = catalog.data

  const smithy = data.smithy
  for (const [index, upgrade] of (smithy?.upgrades ?? []).entries())
    for (const entry of upgrade.materials)
      need(
        catalog.good(entry.good),
        `強化+${index + 1}の素材 ${entry.good} がない`
      )
  if (smithy) byId(smithy.recipes, "レシピ", problems)
  for (const recipe of smithy?.recipes ?? []) {
    need(
      catalog.good(recipe.good),
      `レシピ ${recipe.id} の品物 ${recipe.good} がない`
    )
    for (const entry of recipe.materials)
      need(
        catalog.good(entry.good),
        `レシピ ${recipe.id} の素材 ${entry.good} がない`
      )
  }
}
