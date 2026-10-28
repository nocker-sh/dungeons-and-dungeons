import type { WizSceneCraftingMessage } from "@/lib/wiz/core/runtime/scenes/crafting/state"

export type WizCraftingMessageJaResolvers = Readonly<{
  recipe?: (recipeId: string) => string | undefined
}>

export function formatWizCraftingMessageJa(
  message: WizSceneCraftingMessage,
  resolvers: WizCraftingMessageJaResolvers = {}
): string {
  if (message.type === "missing_facility") return "必要な施設がない..."
  if (message.type === "missing_materials") return "素材が足りない..."
  if (message.type === "craft_failed") return "製作に失敗した... 素材を失った"

  const recipeName = resolvers.recipe?.(message.recipeId) ?? message.recipeId
  const qualityText = message.quality === "high" ? "会心の出来!" : ""
  return `${recipeName}の製作に成功! ${qualityText}`
}
