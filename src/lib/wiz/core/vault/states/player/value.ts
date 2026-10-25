import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizAttributeKey, WizAttributes } from "@/lib/wiz/core/types"
import {
  assertArrayValue,
  assertFiniteNumberValue,
  assertTrimmedNonEmptyStringValue,
  assertRecordValue,
  WizValueValidationError,
} from "@/lib/wiz/core/value-validation"
import type { WizVaultPlayerState } from "@/lib/wiz/core/vault/states/player/schema"

export type WizVaultPlayerDefinition = WizDeepReadonly<WizVaultPlayerState>
const playerOwnership = new WizObjectService()

function assertPositiveFiniteNumber(path: string, value: unknown): asserts value is number {
  assertFiniteNumberValue("player", path, value)
  if (value <= 0) {
    throw new WizValueValidationError("player", path, value, "a finite number greater than 0")
  }
}

function assertPlayerAmount(path: string, value: unknown): asserts value is number {
  assertFiniteNumberValue("player", path, value, { minimum: 0 })
}

function assertPlayerDelta(path: string, value: unknown): asserts value is number {
  assertFiniteNumberValue("player", path, value)
}

const assertPlayerState = (data: WizVaultPlayerDefinition): void => {
  assertRecordValue("player", "$", data)
  assertTrimmedNonEmptyStringValue("player", "name", data.name)
  assertFiniteNumberValue("player", "level", data.level, {
    minimum: 1,
    safeInteger: true,
  })
  assertFiniteNumberValue("player", "exp", data.exp, { minimum: 0 })
  assertPositiveFiniteNumber("expToNextLevel", data.expToNextLevel)
  assertFiniteNumberValue("player", "maxHp", data.maxHp, { minimum: 0 })
  assertFiniteNumberValue("player", "hp", data.hp, {
    maximum: data.maxHp,
    minimum: 0,
  })

  const hasMp = data.mp !== undefined
  const hasMaxMp = data.maxMp !== undefined
  if (hasMp !== hasMaxMp) {
    throw new WizValueValidationError(
      "player",
      "mp",
      { mp: data.mp, maxMp: data.maxMp },
      "mp and maxMp to both be present or both be omitted",
    )
  }
  if (data.mp !== undefined && data.maxMp !== undefined) {
    assertFiniteNumberValue("player", "maxMp", data.maxMp, { minimum: 0 })
    assertFiniteNumberValue("player", "mp", data.mp, {
      maximum: data.maxMp,
      minimum: 0,
    })
  }

  assertFiniteNumberValue("player", "gold", data.gold, { minimum: 0 })
  assertFiniteNumberValue("player", "hunger", data.hunger, {
    maximum: 100,
    minimum: 0,
  })
  assertFiniteNumberValue("player", "maxAp", data.maxAp, { minimum: 0 })
  assertFiniteNumberValue("player", "ap", data.ap, {
    maximum: data.maxAp,
    minimum: 0,
  })

  assertRecordValue("player", "attributes", data.attributes)
  for (const [attribute, value] of Object.entries(data.attributes)) {
    assertFiniteNumberValue("player", `attributes.${attribute}`, value)
  }

  if (data.customAttributes !== undefined) {
    assertRecordValue("player", "customAttributes", data.customAttributes)
    for (const [attribute, value] of Object.entries(data.customAttributes)) {
      assertFiniteNumberValue("player", `customAttributes.${attribute}`, value)
    }
  }

  assertArrayValue("player", "abilityIds", data.abilityIds)
  const seenAbilityIds = new Set<string>()
  for (const [index, abilityId] of data.abilityIds.entries()) {
    assertTrimmedNonEmptyStringValue("player", `abilityIds[${index}]`, abilityId)
    if (seenAbilityIds.has(abilityId)) {
      throw new WizValueValidationError(
        "player",
        `abilityIds[${index}]`,
        abilityId,
        "a unique ability ID",
      )
    }
    seenAbilityIds.add(abilityId)
  }
}

export class WizVaultPlayer {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  private readonly data: WizVaultPlayerDefinition

  constructor(data: WizVaultPlayerDefinition) {
    const ownedData = playerOwnership.ownImmutable(data)
    assertPlayerState(ownedData)
    this.data = ownedData
    WizImmutableValue.freeze(this)
  }

  get name(): string {
    return this.data.name
  }

  get level(): number {
    return this.data.level
  }

  get exp(): number {
    return this.data.exp
  }

  get expToNextLevel(): number {
    return this.data.expToNextLevel
  }

  get hp(): number {
    return this.data.hp
  }

  get maxHp(): number {
    return this.data.maxHp
  }

  get mp(): number {
    return this.data.mp ?? 0
  }

  get maxMp(): number {
    return this.data.maxMp ?? 0
  }

  get gold(): number {
    return this.data.gold
  }

  get attributes(): WizDeepReadonly<WizAttributes> {
    return this.data.attributes
  }

  get abilityIds(): readonly string[] {
    return this.data.abilityIds
  }

  get hunger(): number {
    return this.data.hunger
  }

  get ap(): number {
    return this.data.ap
  }

  get maxAp(): number {
    return this.data.maxAp
  }

  addHunger(amount: number): WizVaultPlayer {
    assertPlayerDelta("addHunger.amount", amount)
    return new WizVaultPlayer({
      ...this.data,
      hunger: Math.max(0, Math.min(100, this.data.hunger + amount)),
    })
  }

  useAp(amount: number): WizVaultPlayer {
    assertPlayerAmount("useAp.amount", amount)
    return new WizVaultPlayer({
      ...this.data,
      ap: Math.max(0, this.data.ap - amount),
    })
  }

  restoreAp(amount: number): WizVaultPlayer {
    assertPlayerAmount("restoreAp.amount", amount)
    return new WizVaultPlayer({
      ...this.data,
      ap: Math.min(this.data.maxAp, this.data.ap + amount),
    })
  }

  resetAp(): WizVaultPlayer {
    return new WizVaultPlayer({
      ...this.data,
      ap: this.data.maxAp,
    })
  }

  hasAp(amount: number): boolean {
    assertPlayerAmount("hasAp.amount", amount)
    return this.data.ap >= amount
  }

  heal(amount: number): WizVaultPlayer {
    assertPlayerAmount("heal.amount", amount)
    return new WizVaultPlayer({
      ...this.data,
      hp: Math.min(this.data.hp + amount, this.data.maxHp),
    })
  }

  damage(amount: number): WizVaultPlayer {
    assertPlayerAmount("damage.amount", amount)
    return new WizVaultPlayer({
      ...this.data,
      hp: Math.max(this.data.hp - amount, 0),
    })
  }

  withHp(value: number): WizVaultPlayer {
    assertPlayerDelta("withHp.value", value)
    return new WizVaultPlayer({
      ...this.data,
      hp: Math.max(0, Math.min(value, this.data.maxHp)),
    })
  }

  withMp(value: number): WizVaultPlayer {
    assertPlayerDelta("withMp.value", value)
    const maxMp = this.data.maxMp
    if (maxMp === undefined) return this
    return new WizVaultPlayer({
      ...this.data,
      mp: Math.max(0, Math.min(value, maxMp)),
    })
  }

  restoreMp(amount: number): WizVaultPlayer {
    assertPlayerAmount("restoreMp.amount", amount)
    return this.withMp(this.mp + amount)
  }

  addGold(amount: number): WizVaultPlayer {
    assertPlayerAmount("addGold.amount", amount)
    return new WizVaultPlayer({
      ...this.data,
      gold: this.data.gold + amount,
    })
  }

  spendGold(amount: number): WizVaultPlayer {
    assertPlayerAmount("spendGold.amount", amount)
    return new WizVaultPlayer({
      ...this.data,
      gold: Math.max(0, this.data.gold - amount),
    })
  }

  addExp(amount: number): WizVaultPlayer {
    assertPlayerAmount("addExp.amount", amount)
    return new WizVaultPlayer({
      ...this.data,
      exp: this.data.exp + amount,
    })
  }

  levelUp(newMaxHp: number, newExpToNextLevel: number): WizVaultPlayer {
    return new WizVaultPlayer({
      ...this.data,
      level: this.data.level + 1,
      exp: 0,
      maxHp: newMaxHp,
      hp: newMaxHp,
      expToNextLevel: newExpToNextLevel,
    })
  }

  addAttribute(attribute: WizAttributeKey, amount: number): WizVaultPlayer {
    assertPlayerDelta("addAttribute.amount", amount)
    return new WizVaultPlayer({
      ...this.data,
      attributes: {
        ...this.data.attributes,
        [attribute]: this.data.attributes[attribute] + amount,
      },
    })
  }

  /**
   * 任意の追加属性 (luck, perception, faith など) の値を返す。
   * 未定義の場合は `undefined`。
   */
  getCustomAttribute(key: string): number | undefined {
    return this.data.customAttributes?.[key]
  }

  /** 追加属性をすべて返す。未定義の場合は空オブジェクト。 */
  get customAttributes(): Readonly<Record<string, number>> {
    return this.data.customAttributes ?? {}
  }

  /** 追加属性を上書き (新規キーも作成可)。 */
  withCustomAttribute(key: string, value: number): WizVaultPlayer {
    assertPlayerDelta(`withCustomAttribute.${key}`, value)
    return new WizVaultPlayer({
      ...this.data,
      customAttributes: {
        ...this.data.customAttributes,
        [key]: value,
      },
    })
  }

  /** 追加属性に増減を加える (未定義キーは 0 から始まる)。 */
  addCustomAttribute(key: string, delta: number): WizVaultPlayer {
    assertPlayerDelta(`addCustomAttribute.${key}`, delta)
    const current = this.data.customAttributes?.[key] ?? 0
    return this.withCustomAttribute(key, current + delta)
  }

  withName(name: string): WizVaultPlayer {
    return new WizVaultPlayer({
      ...this.data,
      name,
    })
  }

  withLevel(level: number): WizVaultPlayer {
    return new WizVaultPlayer({
      ...this.data,
      level,
    })
  }

  withExp(exp: number): WizVaultPlayer {
    return new WizVaultPlayer({
      ...this.data,
      exp,
    })
  }

  withHunger(hunger: number): WizVaultPlayer {
    assertPlayerDelta("withHunger.value", hunger)
    return new WizVaultPlayer({
      ...this.data,
      hunger: Math.max(0, Math.min(100, hunger)),
    })
  }

  withAp(ap: number): WizVaultPlayer {
    assertPlayerDelta("withAp.value", ap)
    return new WizVaultPlayer({
      ...this.data,
      ap: Math.max(0, Math.min(this.data.maxAp, ap)),
    })
  }

  withMaxAp(maxAp: number): WizVaultPlayer {
    assertPlayerAmount("withMaxAp.value", maxAp)
    return new WizVaultPlayer({
      ...this.data,
      ap: Math.min(this.data.ap, maxAp),
      maxAp,
    })
  }

  withAbilityIds(abilityIds: readonly string[]): WizVaultPlayer {
    return new WizVaultPlayer({
      ...this.data,
      abilityIds: [...abilityIds],
    })
  }

  addAbilityId(abilityId: string): WizVaultPlayer {
    if (this.data.abilityIds.includes(abilityId)) {
      return this
    }
    return new WizVaultPlayer({
      ...this.data,
      abilityIds: [...this.data.abilityIds, abilityId],
    })
  }

  hasAbility(abilityId: string): boolean {
    return this.data.abilityIds.includes(abilityId)
  }

  isDead(): boolean {
    return this.data.hp <= 0
  }

  canAfford(cost: number): boolean {
    assertPlayerAmount("canAfford.cost", cost)
    return this.data.gold >= cost
  }

  canLevelUp(): boolean {
    return this.data.exp >= this.data.expToNextLevel
  }

  toPlain(): WizVaultPlayerDefinition {
    return this.data
  }
}

Object.freeze(WizVaultPlayer.prototype)
Object.freeze(WizVaultPlayer)
