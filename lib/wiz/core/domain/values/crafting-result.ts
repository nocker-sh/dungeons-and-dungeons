import type { WizSkillCheckResult } from "@/lib/wiz/core/types"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const objectService = new WizObjectService()

export type WizCraftingQuality = "normal" | "high"

export type WizCraftingResultState =
  | { readonly status: "pending" }
  | {
      readonly status: "success"
      readonly quality: WizCraftingQuality
      readonly diceResult: WizSkillCheckResult
    }
  | {
      readonly status: "failure"
      readonly diceResult: WizSkillCheckResult
      readonly materialsLost: number
    }

export type WizCraftingEvent =
  | {
      readonly type: "craft_succeeded"
      readonly recipeId: string
      readonly quality: WizCraftingQuality
    }
  | {
      readonly type: "craft_failed"
      readonly recipeId: string
      readonly materialsLost: number
    }

export class WizStateCraftingResult {
  private readonly properties: WizCraftingResultState

  constructor(properties: WizCraftingResultState) {
    this.properties = objectService.ownImmutable(properties)
    Object.freeze(this)
  }

  get status(): WizCraftingResultState["status"] {
    return this.properties.status
  }

  get isPending(): boolean {
    return this.properties.status === "pending"
  }

  get isSuccess(): boolean {
    return this.properties.status === "success"
  }

  get isFailure(): boolean {
    return this.properties.status === "failure"
  }

  get quality(): WizCraftingQuality | null {
    if (this.properties.status !== "success") return null
    return this.properties.quality
  }

  get isHighQuality(): boolean {
    return this.properties.status === "success" && this.properties.quality === "high"
  }

  get diceResult(): WizSkillCheckResult | null {
    if (this.properties.status === "pending") return null
    return this.properties.diceResult
  }

  get materialsLost(): number {
    if (this.properties.status !== "failure") return 0
    return this.properties.materialsLost
  }

  toPlain(): WizCraftingResultState {
    return this.properties
  }

  static pending(): WizStateCraftingResult {
    return new WizStateCraftingResult({ status: "pending" })
  }

  static success(diceResult: WizSkillCheckResult): WizStateCraftingResult {
    const quality = diceResult.critical ? "high" : "normal"
    return new WizStateCraftingResult({
      status: "success",
      quality,
      diceResult,
    })
  }

  static failure(diceResult: WizSkillCheckResult, materialsLost: number): WizStateCraftingResult {
    return new WizStateCraftingResult({
      status: "failure",
      diceResult,
      materialsLost,
    })
  }
}
