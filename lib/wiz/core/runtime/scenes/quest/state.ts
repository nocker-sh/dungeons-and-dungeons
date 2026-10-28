import type {
  WizEngineQuestCompletedEvent,
  WizEngineQuestCompletionRejection,
} from "@/lib/wiz/core/engine/quest/progress"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizVaultQuestState } from "@/lib/wiz/core/vault/states/quest/schema"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const objectService = new WizObjectService()

export type WizSceneQuestMessage =
  | {
      readonly type: "quest_selection_rejected"
      readonly questId: string
      readonly reason: "quest_not_found"
    }
  | {
      readonly type: "quest_accepted"
      readonly questId: string
    }
  | {
      readonly type: "quest_acceptance_rejected"
      readonly questId?: string
      readonly reason: "no_selection" | "already_accepted" | "already_completed"
    }
  | WizEngineQuestCompletedEvent
  | {
      readonly type: "quest_completion_rejected"
      readonly rejection:
        | WizEngineQuestCompletionRejection
        | {
            readonly type: "no_selection"
          }
    }

export type WizStateQuestDefinition = {
  readonly type: "quest"
  readonly selectedQuest: WizVaultQuestState | null
  readonly message: WizSceneQuestMessage | null
  readonly vault: WizVaultValue
}

export class WizStateQuest {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "quest" as const
  private readonly properties: WizStateQuestDefinition

  constructor(properties: WizStateQuestDefinition) {
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get vault() {
    return this.properties.vault
  }

  get selectedQuest() {
    return this.properties.selectedQuest
  }

  get message() {
    return this.properties.message
  }

  withSelectedQuest(quest: WizVaultQuestState | null) {
    return new WizStateQuest({
      ...this.properties,
      selectedQuest: quest,
    })
  }

  withMessage(message: WizSceneQuestMessage | null) {
    return new WizStateQuest({
      ...this.properties,
      message,
    })
  }

  withVault(vault: WizVaultValue) {
    return new WizStateQuest({
      ...this.properties,
      vault,
    })
  }

  updateVault(fn: (v: WizVaultValue) => WizVaultValue) {
    return new WizStateQuest({
      ...this.properties,
      vault: fn(this.properties.vault),
    })
  }
}

Object.freeze(WizStateQuest.prototype)
Object.freeze(WizStateQuest)
