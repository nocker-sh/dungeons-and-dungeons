import { WIZ_STANDARD_AFFINITY_DEFINITION } from "@/lib/wiz/core/config/conversation/wiz-conversation-config"
import type {
  WizAffinityDefinition,
  WizAffinityLevelDefinition,
  WizConversationConfig,
  WizStandardAffinityLevel,
} from "@/lib/wiz/core/config/conversation/wiz-conversation-config"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizImmutableValueContract } from "@/lib/wiz/core/immutable-value"
import type { WizId } from "@/lib/wiz/core/types"
import { assertArrayValue } from "@/lib/wiz/core/assert-array-value"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"
import type {
  WizVaultAffinityChange,
  WizVaultAffinityChangeReason,
} from "@/lib/wiz/core/vault/states/npc/affinity"
import type {
  WizVaultGiftPreferences,
  WizVaultNpc,
} from "@/lib/wiz/core/vault/states/npc/type"
import type { WizGiftResolution } from "@/lib/wiz/core/engine/conversation/affinity-system"
import { resolveWizGift } from "@/lib/wiz/core/engine/conversation/resolve-wiz-gift"

export type AffinityChangeResult<TEvent> = Readonly<{
  npc: WizVaultNpc
  event: TEvent
}>

export type WizAffinityProgress = Readonly<{
  readonly current: number
  readonly required: number
  readonly percent: number
}>

export type WizConversationAffinityPort = Readonly<{
  acceptsAffinity: (affinity: number) => boolean
  changeAffinity: (
    npc: WizVaultNpc,
    change: number,
    reason: WizVaultAffinityChangeReason
  ) => AffinityChangeResult<WizVaultAffinityChange>
  getAffinityLevel: (affinity: number) => string
  getProgressToNextLevel: (affinity: number) => WizAffinityProgress | null
  getGiftAffinityChange: (
    preferences: WizVaultGiftPreferences | undefined,
    itemId: WizId
  ) => number
  resolveGift: (
    preferences: WizVaultGiftPreferences | undefined,
    itemId: WizId
  ) => WizGiftResolution
}>

export class WizConversationAffinitySystem<TLevel extends string = string>
  implements WizConversationAffinityPort, WizImmutableValueContract
{
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly levels: readonly WizAffinityLevelDefinition<TLevel>[]
  readonly #minimum: number
  readonly #maximum: number

  constructor(definition: WizAffinityDefinition<TLevel>) {
    assertRecordValue("affinity", "definition", definition)
    assertFiniteNumberValue("affinity", "minimum", definition.minimum)
    assertFiniteNumberValue("affinity", "maximum", definition.maximum)
    if (definition.minimum > definition.maximum) {
      throw new WizValueValidationError(
        "affinity",
        "minimum",
        definition.minimum,
        `at most ${definition.maximum}`
      )
    }
    assertArrayValue("affinity", "levels", definition.levels)
    if (definition.levels.length === 0) {
      throw new WizValueValidationError(
        "affinity",
        "levels",
        definition.levels,
        "a non-empty array"
      )
    }

    const levelIds = new Set<string>()
    let previousMinimum = Number.NEGATIVE_INFINITY
    definition.levels.forEach((level, index) => {
      const path = `levels[${index}]`
      assertRecordValue("affinity", path, level)
      assertTrimmedNonEmptyStringValue("affinity", `${path}.id`, level.id)
      assertFiniteNumberValue("affinity", `${path}.minimum`, level.minimum, {
        maximum: definition.maximum,
        minimum: definition.minimum,
      })
      if (index === 0 && level.minimum !== definition.minimum) {
        throw new WizValueValidationError(
          "affinity",
          `${path}.minimum`,
          level.minimum,
          `equal to minimum ${definition.minimum}`
        )
      }
      if (level.minimum <= previousMinimum) {
        throw new WizValueValidationError(
          "affinity",
          `${path}.minimum`,
          level.minimum,
          `greater than ${previousMinimum}`
        )
      }
      if (levelIds.has(level.id)) {
        throw new WizValueValidationError(
          "affinity",
          `${path}.id`,
          level.id,
          "a unique affinity level ID"
        )
      }
      levelIds.add(level.id)
      previousMinimum = level.minimum
    })

    this.#minimum = definition.minimum
    this.#maximum = definition.maximum
    this.levels = Object.freeze(
      definition.levels.map((level) =>
        Object.freeze({
          id: level.id,
          minimum: level.minimum,
        })
      )
    )
    WizImmutableValue.freeze(this)
  }

  static fromConfig(
    config: WizConversationConfig
  ): WizConversationAffinitySystem {
    return new WizConversationAffinitySystem(config.affinity)
  }

  acceptsAffinity(affinity: number): boolean {
    return (
      Number.isFinite(affinity) &&
      affinity >= this.#minimum &&
      affinity <= this.#maximum
    )
  }

  changeAffinity(
    npc: WizVaultNpc,
    change: number,
    reason: WizVaultAffinityChangeReason
  ): AffinityChangeResult<WizVaultAffinityChange> {
    assertFiniteNumberValue("affinity", "change", change)
    return this.changeWithReason(npc, change, Object.freeze({ ...reason }))
  }

  getAffinityLevel(affinity: number): TLevel {
    assertFiniteNumberValue("affinity", "affinity", affinity)
    for (let index = this.levels.length - 1; index >= 0; index -= 1) {
      const level = this.levels[index]
      if (level !== undefined && affinity >= level.minimum) {
        return level.id
      }
    }
    return this.levels[0]!.id
  }

  getProgressToNextLevel(affinity: number): WizAffinityProgress | null {
    const currentLevel = this.getAffinityLevel(affinity)
    const currentIndex = this.levels.findIndex(
      (level) => level.id === currentLevel
    )
    const current = this.levels[currentIndex]
    const next = this.levels[currentIndex + 1]
    if (current === undefined || next === undefined) return null

    const required = next.minimum - current.minimum
    const progress = Math.max(0, Math.min(affinity - current.minimum, required))
    return Object.freeze({
      current: progress,
      required,
      percent: Math.floor((progress / required) * 100),
    })
  }

  getGiftAffinityChange(
    preferences: WizVaultGiftPreferences | undefined,
    itemId: WizId
  ): number {
    return this.resolveGift(preferences, itemId).affinityChange
  }

  resolveGift(
    preferences: WizVaultGiftPreferences | undefined,
    itemId: WizId
  ): WizGiftResolution {
    return resolveWizGift(preferences, itemId)
  }

  private changeWithReason<TReason>(
    npc: WizVaultNpc,
    change: number,
    reason: TReason
  ): AffinityChangeResult<
    Omit<WizVaultAffinityChange, "reason"> & Readonly<{ reason: TReason }>
  > {
    const previousAffinity = npc.affinity
    const newAffinity = Math.max(
      this.#minimum,
      Math.min(this.#maximum, npc.affinity + change)
    )
    const updatedNpc: WizVaultNpc = Object.freeze({
      ...npc,
      affinity: newAffinity,
    })
    const event = Object.freeze({
      npcId: npc.id,
      previousAffinity,
      newAffinity,
      change: newAffinity - previousAffinity,
      reason,
    })

    return Object.freeze({ npc: updatedNpc, event })
  }
}

export const createWizStandardConversationAffinitySystem =
  (): WizConversationAffinitySystem<WizStandardAffinityLevel> =>
    new WizConversationAffinitySystem(WIZ_STANDARD_AFFINITY_DEFINITION)

Object.freeze(WizConversationAffinitySystem.prototype)

Object.freeze(WizConversationAffinitySystem)
