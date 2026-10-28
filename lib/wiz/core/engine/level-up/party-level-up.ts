import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type {
  WizDeepReadonly,
  WizImmutableValueContract,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { WIZ_ATTRIBUTE_KEYS, type WizAttributeKey } from "@/lib/wiz/core/types"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"
import type { WizVaultPartyMemberState } from "@/lib/wiz/core/vault/states/player/schema"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export type WizPartyMemberGrowth = Readonly<{
  readonly hp: number
  readonly mp: number
  readonly attributes?: Readonly<Partial<Record<WizAttributeKey, number>>>
}>

export type WizPartyMemberGrowthTableDefinition = Readonly<{
  readonly classes: Readonly<Record<string, WizPartyMemberGrowth>>
  readonly fallback?: WizPartyMemberGrowth
}>

export type WizPartyLevelUpPort = Readonly<{
  applyPartyLevelUp: (
    vault: WizVaultValue,
    targetLevel: number
  ) => WizVaultValue
}>

const ATTRIBUTE_KEY_SET = new Set<string>(WIZ_ATTRIBUTE_KEYS)
const growthOwnership = new WizObjectService()

const validateGrowth = (growth: unknown, path: string): void => {
  assertRecordValue("party-growth", path, growth)
  assertFiniteNumberValue("party-growth", `${path}.hp`, growth.hp, {
    minimum: 0,
  })
  assertFiniteNumberValue("party-growth", `${path}.mp`, growth.mp, {
    minimum: 0,
  })
  if (growth.attributes === undefined) return

  assertRecordValue("party-growth", `${path}.attributes`, growth.attributes)
  for (const [attribute, value] of Object.entries(growth.attributes)) {
    if (!ATTRIBUTE_KEY_SET.has(attribute)) {
      throw new WizValueValidationError(
        "party-growth",
        `${path}.attributes.${attribute}`,
        attribute,
        `one of ${WIZ_ATTRIBUTE_KEYS.join(", ")}`
      )
    }
    assertFiniteNumberValue(
      "party-growth",
      `${path}.attributes.${attribute}`,
      value
    )
  }
}

export class WizPartyMemberGrowthNotFoundError extends RangeError {
  override readonly name = "WizPartyMemberGrowthNotFoundError"

  constructor(readonly classId: string) {
    super(`Party member growth is not defined for class ID "${classId}"`)
    Object.freeze(this)
  }
}

export class WizPartyMemberGrowthTable implements WizImmutableValueContract {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #classes: Readonly<Record<string, WizPartyMemberGrowth>>
  readonly #fallback: WizPartyMemberGrowth | undefined

  constructor(definition: WizPartyMemberGrowthTableDefinition) {
    assertRecordValue("party-growth", "definition", definition)
    assertRecordValue("party-growth", "classes", definition.classes)
    for (const [classId, growth] of Object.entries(definition.classes)) {
      assertTrimmedNonEmptyStringValue(
        "party-growth",
        `classes.${classId}.classId`,
        classId
      )
      validateGrowth(growth, `classes.${classId}`)
    }
    if (definition.fallback !== undefined) {
      validateGrowth(definition.fallback, "fallback")
    }

    this.#classes = growthOwnership.ownImmutable(definition.classes)
    this.#fallback =
      definition.fallback === undefined
        ? undefined
        : growthOwnership.ownImmutable(definition.fallback)
    WizImmutableValue.freeze(this)
  }

  growthFor(classId: string): WizPartyMemberGrowth {
    assertTrimmedNonEmptyStringValue("party-growth", "classId", classId)
    const growth = this.#classes[classId] ?? this.#fallback
    if (growth === undefined) {
      throw new WizPartyMemberGrowthNotFoundError(classId)
    }
    return growth
  }
}

export class WizEnginePartyLevelUp implements WizPartyLevelUpPort {
  constructor(readonly growthTable: WizPartyMemberGrowthTable) {
    if (!(growthTable instanceof WizPartyMemberGrowthTable)) {
      throw new TypeError("Party level-up requires a WizPartyMemberGrowthTable")
    }
    Object.freeze(this)
  }

  levelUpMember(
    member: WizDeepReadonly<WizVaultPartyMemberState>,
    targetLevel: number
  ): WizDeepReadonly<WizVaultPartyMemberState> {
    if (member.level >= targetLevel) return member

    const growth = this.growthTable.growthFor(member.classId)
    const levelsGained = targetLevel - member.level
    const hpGain = growth.hp * levelsGained
    const mpGain = growth.mp * levelsGained
    const attributes = Object.fromEntries(
      WIZ_ATTRIBUTE_KEYS.map((attribute) => [
        attribute,
        member.attributes[attribute] +
          (growth.attributes?.[attribute] ?? 0) * levelsGained,
      ])
    ) as Record<WizAttributeKey, number>

    return {
      ...member,
      level: targetLevel,
      maxHp: member.maxHp + hpGain,
      hp: member.hp + hpGain,
      maxMp: member.maxMp + mpGain,
      mp: member.mp + mpGain,
      attributes,
      abilityIds: [...member.abilityIds],
    }
  }

  applyPartyLevelUp(vault: WizVaultValue, targetLevel: number): WizVaultValue {
    const updatedMembers = vault.partyMembers.map((member) =>
      this.levelUpMember(member, targetLevel)
    )
    return vault.withPartyMembers(updatedMembers)
  }
}

Object.freeze(WizPartyMemberGrowthTable.prototype)
Object.freeze(WizPartyMemberGrowthTable)
Object.freeze(WizEnginePartyLevelUp.prototype)
Object.freeze(WizEnginePartyLevelUp)
