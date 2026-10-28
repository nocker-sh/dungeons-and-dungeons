export type WizSceneCraftingAction =
  | Readonly<{ type: "SELECT_RECIPE"; recipeId: string }>
  | Readonly<{ type: "CONFIRM_CRAFT" }>
  | Readonly<{ type: "CANCEL_CRAFT" }>
  | Readonly<{ type: "LEAVE_CRAFTING" }>
