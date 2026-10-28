import { WizAttributeSet } from "@/lib/wiz/core/domain/values/attribute-set"
import { WizResourceSet } from "@/lib/wiz/core/domain/values/resource-set"
import type { WizBattleStatusView } from "@/lib/wiz/core/types/wiz-types"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertFiniteNumericFields } from "@/lib/wiz/core/assert-finite-numeric-fields"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"

export type WizBattleAttributeId = "attack" | "defense" | "speed"
export type WizBattleResourceId = "health" | "mana"

export type WizBattleActorStateDefinition<TCustom = unknown> = Readonly<{
  attributes: Readonly<Record<WizBattleAttributeId, number>>
  resources: Readonly<{
    health: Readonly<{ current: number; maximum: number }>
    mana: Readonly<{ current: number; maximum: number }>
  }>
  custom: TCustom
}>

export type WizBattleActorStateProperties<TCustom = unknown> = Readonly<{
  attributes: WizAttributeSet<WizBattleAttributeId>
  resources: WizResourceSet<WizBattleResourceId>
  custom: WizDeepReadonly<TCustom>
}>

const actorStateConstructionToken = Symbol("WizBattleActorState.constructor")
const authenticActorStates = new WeakSet<object>()
const actorStateOwnership = new WizObjectService()

/**
 * 標準battle presetのactor状態。
 *
 * 数値の正本は汎用`WizAttributeSet`と`WizResourceSet`に置き、
 * turn制固有の操作だけをこのclassへ閉じ込める。高頻度simulationや作品固有resourceは
 * このclassを使わず、汎用setを直接構成できる。
 */
export class WizBattleActorState<TCustom = unknown> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly attributes: WizAttributeSet<WizBattleAttributeId>
  readonly resources: WizResourceSet<WizBattleResourceId>
  readonly custom: WizDeepReadonly<TCustom>

  private constructor(
    token: typeof actorStateConstructionToken,
    properties: Readonly<{
      attributes: WizAttributeSet<WizBattleAttributeId>
      resources: WizResourceSet<WizBattleResourceId>
      custom: TCustom | WizDeepReadonly<TCustom>
    }>
  ) {
    if (token !== actorStateConstructionToken) {
      throw new TypeError(
        "WizBattleActorState must be created with create() or fromComponents()"
      )
    }
    WizAttributeSet.require(properties.attributes, "Battle actor attributes")
    WizResourceSet.require(properties.resources, "Battle actor resources")
    assertFiniteNumericFields("battle-actor-state", "custom", properties.custom)
    this.attributes = properties.attributes
    this.resources = properties.resources
    this.custom = actorStateOwnership.ownImmutable<TCustom>(properties.custom)
    authenticActorStates.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<TCustom = unknown>(
    definition: WizBattleActorStateDefinition<TCustom>
  ): WizBattleActorState<TCustom> {
    assertRecordValue("battle-actor-state", "$", definition)
    return new WizBattleActorState(actorStateConstructionToken, {
      attributes: WizAttributeSet.create(definition.attributes),
      resources: WizResourceSet.create(definition.resources),
      custom: definition.custom,
    })
  }

  static fromComponents<TCustom = unknown>(
    properties: WizBattleActorStateProperties<TCustom>
  ): WizBattleActorState<TCustom> {
    return new WizBattleActorState(actorStateConstructionToken, properties)
  }

  static require(
    value: unknown,
    label = "Battle actor state"
  ): asserts value is WizBattleActorState {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticActorStates.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizBattleActorState.create() or fromComponents()`
      )
    }
  }

  withResources(
    resources: WizResourceSet<WizBattleResourceId>
  ): WizBattleActorState<TCustom> {
    return WizBattleActorState.fromComponents({
      attributes: this.attributes,
      resources,
      custom: this.custom,
    })
  }

  withAttributes(
    attributes: WizAttributeSet<WizBattleAttributeId>
  ): WizBattleActorState<TCustom> {
    return WizBattleActorState.fromComponents({
      attributes,
      resources: this.resources,
      custom: this.custom,
    })
  }

  withCustom<TNewCustom>(custom: TNewCustom): WizBattleActorState<TNewCustom> {
    return new WizBattleActorState<TNewCustom>(actorStateConstructionToken, {
      attributes: this.attributes,
      resources: this.resources,
      custom,
    })
  }

  withHealth(current: number): WizBattleActorState<TCustom> {
    assertFiniteNumberValue("battle-actor-state", "health.current", current)
    const clamped = Math.max(
      0,
      Math.min(current, this.resources.maximum("health"))
    )
    return this.withResources(this.resources.withCurrent("health", clamped))
  }

  takeDamage(amount: number): WizBattleActorState<TCustom> {
    assertFiniteNumberValue("battle-actor-state", "damage", amount, {
      minimum: 0,
    })
    return this.withHealth(this.resources.current("health") - amount)
  }

  restoreHealth(amount: number): WizBattleActorState<TCustom> {
    assertFiniteNumberValue("battle-actor-state", "health.restore", amount, {
      minimum: 0,
    })
    return this.withResources(this.resources.restore("health", amount))
  }

  spendMana(amount: number): WizBattleActorState<TCustom> {
    assertFiniteNumberValue("battle-actor-state", "mana.cost", amount, {
      minimum: 0,
    })
    return this.withResources(this.resources.spend({ mana: amount }))
  }

  restoreMana(amount: number): WizBattleActorState<TCustom> {
    assertFiniteNumberValue("battle-actor-state", "mana.restore", amount, {
      minimum: 0,
    })
    return this.withResources(this.resources.restore("mana", amount))
  }

  isAlive(): boolean {
    return this.resources.current("health") > 0
  }

  healthRatio(): number {
    const maximum = this.resources.maximum("health")
    return maximum > 0 ? this.resources.current("health") / maximum : 0
  }

  manaRatio(): number {
    const maximum = this.resources.maximum("mana")
    return maximum > 0 ? this.resources.current("mana") / maximum : 0
  }

  hasMana(amount: number): boolean {
    assertFiniteNumberValue("battle-actor-state", "mana.required", amount, {
      minimum: 0,
    })
    return this.resources.current("mana") >= amount
  }

  scaleAttribute(
    attributeId: WizBattleAttributeId,
    multiplier: number
  ): WizBattleActorState<TCustom> {
    assertFiniteNumberValue(
      "battle-actor-state",
      "attribute.multiplier",
      multiplier
    )
    return this.withAttributes(
      this.attributes.withValue(
        attributeId,
        Math.floor(this.attributes.value(attributeId) * multiplier)
      )
    )
  }

  /**
   * 標準damage/evasion formulaへ渡すreadonly view。
   * 汎用setの保存表現とは分離し、formula boundaryだけでflattenする。
   */
  toFormulaView(): WizBattleStatusView<TCustom> {
    const custom =
      typeof this.custom === "object" && this.custom !== null
        ? this.custom
        : Object.freeze({})

    return Object.freeze({
      ...custom,
      attack: this.attributes.value("attack"),
      defense: this.attributes.value("defense"),
      hp: this.resources.current("health"),
      maxHp: this.resources.maximum("health"),
      mp: this.resources.current("mana"),
      maxMp: this.resources.maximum("mana"),
      speed: this.attributes.value("speed"),
    }) as WizBattleStatusView<TCustom>
  }

  toProperties(): WizBattleActorStateProperties<TCustom> {
    return {
      attributes: this.attributes,
      resources: this.resources,
      custom: this.custom,
    }
  }
}

Object.freeze(WizBattleActorState.prototype)
Object.freeze(WizBattleActorState)
