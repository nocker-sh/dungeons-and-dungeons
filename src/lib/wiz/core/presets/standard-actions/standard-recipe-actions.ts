import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { createWizStandardActionValue } from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import type { WizStandardRecipeId } from "@/lib/wiz/core/presets/standard-actions/content-types"

const standardRecipeActionsConstructionToken = Symbol("WizStandardRecipeActions.constructor")

export class WizStandardRecipeActions<
  TArrays extends WorldContentArrays,
  TRecipeId extends WizStandardRecipeId<TArrays>,
> {
  readonly recipeId: TRecipeId
  readonly #origin: symbol

  private constructor(
    token: typeof standardRecipeActionsConstructionToken,
    origin: symbol,
    recipeId: TRecipeId,
  ) {
    if (token !== standardRecipeActionsConstructionToken) {
      throw new TypeError("WizStandardRecipeActions must be created by WizStandardActions")
    }
    this.#origin = origin
    this.recipeId = recipeId
    Object.freeze(this)
  }

  /** @internal */
  static create<TArrays extends WorldContentArrays, TRecipeId extends WizStandardRecipeId<TArrays>>(
    token: typeof standardRecipeActionsConstructionToken,
    origin: symbol,
    recipeId: TRecipeId,
  ): WizStandardRecipeActions<TArrays, TRecipeId> {
    return new WizStandardRecipeActions<TArrays, TRecipeId>(token, origin, recipeId)
  }

  select() {
    return createWizStandardActionValue(this.#origin, {
      type: "SELECT_RECIPE",
      recipeId: this.recipeId,
    })
  }
}

Object.freeze(WizStandardRecipeActions.prototype)
Object.freeze(WizStandardRecipeActions)

/** @internal */
export const createWizStandardRecipeActions = <
  TArrays extends WorldContentArrays,
  TRecipeId extends WizStandardRecipeId<TArrays>,
>(
  origin: symbol,
  recipeId: TRecipeId,
): WizStandardRecipeActions<TArrays, TRecipeId> =>
  WizStandardRecipeActions.create<TArrays, TRecipeId>(
    standardRecipeActionsConstructionToken,
    origin,
    recipeId,
  )
