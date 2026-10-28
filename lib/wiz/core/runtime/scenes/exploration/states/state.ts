import type { WizItemEffectRejection } from "@/lib/wiz/core/domain/services/item-effect-service"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizSkillCheckResult } from "@/lib/wiz/core/types"
import type { WizVaultEventState } from "@/lib/wiz/core/vault/states/event/schema"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const objectService = new WizObjectService()

export type WizSceneExplorationActionType =
  | "explore"
  | "gather"
  | "hunt"
  | "rest"

export type WizSceneExplorationMessage =
  | {
      readonly type: "event_encountered"
      readonly eventId: string
    }
  | {
      readonly type: "items_gathered"
      readonly areaId: string
      readonly itemIds: readonly string[]
    }
  | {
      readonly type: "gather_rejected"
      readonly areaId: string
      readonly reason: "nothing_available" | "environment"
    }
  | {
      readonly type: "action_rejected"
      readonly action: WizSceneExplorationActionType
      readonly areaId: string
      readonly reason:
        | "area_not_found"
        | "not_enough_ap"
        | "no_targets_available"
        | "random_selection_failed"
        | "content_not_found"
        | "already_rested"
      readonly referenceId?: string
    }
  | {
      readonly type: "event_choice_rejected"
      readonly reason: "event_not_active" | "choice_not_found"
      readonly choiceIndex: number
    }
  | {
      readonly type: "event_roll_rejected"
      readonly reason:
        | "event_not_active"
        | "choice_not_selected"
        | "choice_not_found"
      readonly choiceIndex?: number
    }
  | {
      readonly type: "food_rejected"
      readonly itemId: string
      readonly reason:
        | "item_not_found"
        | "not_food"
        | "not_owned"
        | "effect_rejected"
      readonly effectRejection?: WizItemEffectRejection
    }

export type WizSceneExplorationEventProgress =
  | { readonly status: "none" }
  | {
      readonly status: "encounter"
      readonly event: WizVaultEventState
      readonly choiceIndex: number | null
    }
  | {
      readonly status: "rolling"
      readonly event: WizVaultEventState
      readonly choiceIndex: number
    }
  | {
      readonly status: "result"
      readonly event: WizVaultEventState
      readonly choiceIndex: number
      readonly diceResult: WizSkillCheckResult
      readonly resultText: string
    }

export type WizStateExplorationDefinition = {
  readonly type: "exploration"
  readonly areaId: string
  readonly eventProgress: WizSceneExplorationEventProgress
  readonly message: WizSceneExplorationMessage | null
  readonly vault: WizVaultValue
}

export class WizStateExploration {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "exploration" as const
  private readonly properties: WizStateExplorationDefinition

  constructor(properties: WizStateExplorationDefinition) {
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get vault() {
    return this.properties.vault
  }

  get areaId() {
    return this.properties.areaId
  }

  get eventProgress() {
    return this.properties.eventProgress
  }

  get message() {
    return this.properties.message
  }

  withEventProgress(progress: WizSceneExplorationEventProgress) {
    return new WizStateExploration({
      ...this.properties,
      eventProgress: progress,
    })
  }

  withMessage(message: WizSceneExplorationMessage | null) {
    return new WizStateExploration({
      ...this.properties,
      message,
    })
  }

  withVault(vault: WizVaultValue) {
    return new WizStateExploration({
      ...this.properties,
      vault,
    })
  }

  updateVault(fn: (v: WizVaultValue) => WizVaultValue) {
    return new WizStateExploration({
      ...this.properties,
      vault: fn(this.properties.vault),
    })
  }
}

Object.freeze(WizStateExploration.prototype)
Object.freeze(WizStateExploration)
