import type { WizSkillCheckResult } from "@/lib/wiz/core/types"
import type { WizVaultEventState } from "@/lib/wiz/core/vault/states/event/schema"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const objectService = new WizObjectService()

type Properties =
  | { status: "none" }
  | {
      status: "encounter"
      event: WizVaultEventState
      choiceIndex: number | null
    }
  | { status: "rolling"; event: WizVaultEventState; choiceIndex: number }
  | {
      status: "result"
      event: WizVaultEventState
      choiceIndex: number
      diceResult: WizSkillCheckResult
      resultText: string
    }

export class WizEngineExplorationEventProgress {
  private readonly properties: Properties

  constructor(properties: Properties) {
    this.properties = objectService.ownImmutable(properties)
    Object.freeze(this)
  }

  get status(): Properties["status"] {
    return this.properties.status
  }

  get isNone(): boolean {
    return this.properties.status === "none"
  }

  get isEncounter(): boolean {
    return this.properties.status === "encounter"
  }

  get isResult(): boolean {
    return this.properties.status === "result"
  }

  get event(): WizVaultEventState | null {
    if (this.properties.status === "none") return null
    return this.properties.event
  }

  get choiceIndex(): number | null {
    if (this.properties.status === "none") return null
    return this.properties.choiceIndex
  }

  get diceResult(): WizSkillCheckResult | null {
    if (this.properties.status !== "result") return null
    return this.properties.diceResult
  }

  get resultText(): string | null {
    if (this.properties.status !== "result") return null
    return this.properties.resultText
  }

  withChoiceIndex(index: number): WizEngineExplorationEventProgress {
    if (this.properties.status !== "encounter") return this
    return new WizEngineExplorationEventProgress({
      ...this.properties,
      choiceIndex: index,
    })
  }

  toResult(diceResult: WizSkillCheckResult, resultText: string): WizEngineExplorationEventProgress {
    if (this.properties.status !== "encounter" || this.properties.choiceIndex === null) {
      return this
    }
    return new WizEngineExplorationEventProgress({
      status: "result",
      event: this.properties.event,
      choiceIndex: this.properties.choiceIndex,
      diceResult,
      resultText,
    })
  }

  toPlain(): Properties {
    return this.properties
  }

  static none(): WizEngineExplorationEventProgress {
    return new WizEngineExplorationEventProgress({ status: "none" })
  }

  static encounter(
    event: WizVaultEventState,
    choiceIndex: number | null = null,
  ): WizEngineExplorationEventProgress {
    return new WizEngineExplorationEventProgress({
      status: "encounter",
      event,
      choiceIndex,
    })
  }

  static result(
    event: WizVaultEventState,
    choiceIndex: number,
    diceResult: WizSkillCheckResult,
    resultText: string,
  ): WizEngineExplorationEventProgress {
    return new WizEngineExplorationEventProgress({
      status: "result",
      event,
      choiceIndex,
      diceResult,
      resultText,
    })
  }
}
